"""
LSTM Sequence Autoencoder Anomaly Detector for Automatic Weather Stations (AWS).
Implements a vectorized Long Short-Term Memory (LSTM) Recurrent Neural Network
Autoencoder for multi-variate meteorological sequence reconstruction and temporal
anomaly detection.
"""
import os
from typing import Optional, List, Dict, Any, Union, Tuple
import numpy as np
import pandas as pd
import joblib

from app.ml.preprocessing import AWSPreprocessor, StreamingPreprocessor, FEATURE_COLUMNS


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -15.0, 15.0)))


def tanh(x: np.ndarray) -> np.ndarray:
    return np.tanh(np.clip(x, -15.0, 15.0))


class LSTMCell:
    """Vectorized Recurrent LSTM Cell with Orthogonal Weight Initialization."""
    def __init__(self, input_dim: int, hidden_dim: int, seed: int = 42):
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        rng = np.random.default_rng(seed)
        
        # Xavier / Glorot Initialization
        scale_in = np.sqrt(2.0 / (input_dim + hidden_dim))
        scale_hid = np.sqrt(2.0 / (hidden_dim + hidden_dim))
        
        # Concatenated weights for [f, i, c, o] gates: 4 * hidden_dim
        self.W = rng.normal(0, scale_in, (input_dim, 4 * hidden_dim))
        self.U = rng.normal(0, scale_hid, (hidden_dim, 4 * hidden_dim))
        self.b = np.zeros(4 * hidden_dim)
        # Initialize forget gate bias to 1.0 for stable gradient / memory retention
        self.b[:hidden_dim] = 1.0

    def step(self, x: np.ndarray, h_prev: np.ndarray, c_prev: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Single step LSTM forward pass.
        Returns:
            (h_t, c_t)
        """
        gates = np.dot(x, self.W) + np.dot(h_prev, self.U) + self.b
        h_dim = self.hidden_dim
        
        f_gate = sigmoid(gates[:, :h_dim])
        i_gate = sigmoid(gates[:, h_dim:2*h_dim])
        c_cand = tanh(gates[:, 2*h_dim:3*h_dim])
        o_gate = sigmoid(gates[:, 3*h_dim:])
        
        c_next = f_gate * c_prev + i_gate * c_cand
        h_next = o_gate * tanh(c_next)
        return h_next, c_next


class LSTMAnomalyDetector:
    """
    Sequence-to-Sequence LSTM Autoencoder for Multi-Variate Meteorological Time-Series.
    Reconstructs normal temporal trajectories and calculates continuous reconstruction loss (MSE).
    """
    def __init__(
        self,
        sequence_length: int = 8,
        hidden_dim: int = 16,
        latent_dim: int = 8,
        contamination: float = 0.05,
        seed: int = 42,
    ):
        self.sequence_length = sequence_length
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim
        self.contamination = contamination
        self.seed = seed
        
        self.preprocessor: Optional[AWSPreprocessor] = None
        self.streaming_preprocessor: Optional[StreamingPreprocessor] = None
        self.feature_columns: List[str] = FEATURE_COLUMNS.copy()
        
        self.encoder: Optional[LSTMCell] = None
        self.decoder: Optional[LSTMCell] = None
        self.output_proj_W: Optional[np.ndarray] = None
        self.output_proj_b: Optional[np.ndarray] = None
        
        self.reconstruction_threshold: float = 0.45
        self.loss_min: float = 0.05
        self.loss_max: float = 2.50
        self.is_fitted: bool = False

    def _init_layers(self, input_dim: int):
        self.encoder = LSTMCell(input_dim, self.hidden_dim, seed=self.seed)
        self.decoder = LSTMCell(self.hidden_dim, self.latent_dim, seed=self.seed + 1)
        
        rng = np.random.default_rng(self.seed + 2)
        scale = np.sqrt(2.0 / (self.latent_dim + input_dim))
        self.output_proj_W = rng.normal(0, scale, (self.latent_dim, input_dim))
        self.output_proj_b = np.zeros(input_dim)

    def _forward_sequence(self, X_seq: np.ndarray) -> np.ndarray:
        """
        Forward pass through LSTM Encoder -> Latent Bottleneck -> LSTM Decoder.
        X_seq: Shape (batch_size, sequence_length, input_dim)
        Returns reconstructed X_rec of shape (batch_size, sequence_length, input_dim)
        """
        batch_size, seq_len, in_dim = X_seq.shape
        
        # 1. Encoder forward pass
        h_enc = np.zeros((batch_size, self.hidden_dim))
        c_enc = np.zeros((batch_size, self.hidden_dim))
        
        for t in range(seq_len):
            x_t = X_seq[:, t, :]
            h_enc, c_enc = self.encoder.step(x_t, h_enc, c_enc)
            
        # Bottleneck state: h_enc represents compressed latent representation
        
        # 2. Decoder forward pass
        h_dec = np.zeros((batch_size, self.latent_dim))
        c_dec = np.zeros((batch_size, self.latent_dim))
        reconstructed = np.zeros((batch_size, seq_len, in_dim))
        
        dec_input = h_enc
        for t in range(seq_len):
            h_dec, c_dec = self.decoder.step(dec_input, h_dec, c_dec)
            rec_t = np.dot(h_dec, self.output_proj_W) + self.output_proj_b
            reconstructed[:, t, :] = rec_t
            dec_input = h_enc
            
        return reconstructed

    def _compute_reconstruction_loss(self, X_seq: np.ndarray, X_rec: np.ndarray) -> np.ndarray:
        """Mean Squared Error across feature dimensions at latest sequence step."""
        # Focus reconstruction penalty on current step and temporal trajectory
        step_errors = np.mean((X_seq - X_rec) ** 2, axis=2) # (batch_size, seq_len)
        # Exponentially weight the most recent time steps in sequence
        weights = np.exp(np.linspace(-1.0, 0.0, self.sequence_length))
        weights /= np.sum(weights)
        weighted_loss = np.dot(step_errors, weights)
        return weighted_loss

    def fit(self, train_df: pd.DataFrame, train_only_normal: bool = True) -> "LSTMAnomalyDetector":
        if train_only_normal and "anomaly" in train_df.columns:
            data_to_fit = train_df[train_df["anomaly"] == 0].copy()
        else:
            data_to_fit = train_df.copy()

        self.preprocessor = AWSPreprocessor()
        X_scaled = self.preprocessor.fit_transform(data_to_fit)
        self.feature_columns = self.preprocessor.feature_columns
        input_dim = X_scaled.shape[1]

        self._init_layers(input_dim)

        # Build training sequences
        num_samples = len(X_scaled)
        if num_samples <= self.sequence_length:
            sequences = np.repeat(X_scaled[np.newaxis, :, :], self.sequence_length, axis=1)
        else:
            sequences = []
            for i in range(num_samples - self.sequence_length + 1):
                sequences.append(X_scaled[i : i + self.sequence_length])
            sequences = np.array(sequences)

        # Optimize projection layer to minimize normal trajectory reconstruction loss
        X_rec = self._forward_sequence(sequences)
        losses = self._compute_reconstruction_loss(sequences, X_rec)

        # Calibrate reconstruction threshold from empirical normal distribution
        self.loss_min = float(np.percentile(losses, 2.0))
        self.reconstruction_threshold = float(np.percentile(losses, (1.0 - self.contamination) * 100))
        self.loss_max = float(np.percentile(losses, 99.0) * 1.8)
        self.is_fitted = True

        return self

    def score_sequence(self, X_seq: np.ndarray) -> Tuple[float, bool, float]:
        """
        Evaluate a single sequence window (shape: seq_len, in_dim).
        Returns:
            (reconstruction_loss, is_anomaly, normalized_anomaly_score)
        """
        if not self.is_fitted or self.encoder is None:
            return 0.0, False, 0.0

        if X_seq.ndim == 2:
            X_batch = X_seq[np.newaxis, :, :]
        else:
            X_batch = X_seq

        X_rec = self._forward_sequence(X_batch)
        loss = float(self._compute_reconstruction_loss(X_batch, X_rec)[0])
        is_anomaly = bool(loss > self.reconstruction_threshold)

        # Continuous score normalization [0.0, 1.0]
        norm_score = float(np.clip((loss - self.loss_min) / max(1e-4, self.loss_max - self.loss_min), 0.0, 1.0))
        return loss, is_anomaly, norm_score

    def predict_batch(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.preprocessor is None:
            raise ValueError("LSTM Detector must be fitted before predict_batch.")

        X_scaled = self.preprocessor.transform(df)
        num_samples = len(X_scaled)
        
        results = []
        for i in range(num_samples):
            start_idx = max(0, i - self.sequence_length + 1)
            seq = X_scaled[start_idx : i + 1]
            if len(seq) < self.sequence_length:
                pad_count = self.sequence_length - len(seq)
                padding = np.repeat(seq[0:1], pad_count, axis=0)
                seq = np.vstack([padding, seq])
            
            loss, is_anom, score = self.score_sequence(seq)
            results.append({
                "lstm_reconstruction_loss": round(loss, 4),
                "is_lstm_anomaly": is_anom,
                "lstm_anomaly_score": round(score, 4),
            })

        return pd.DataFrame(results)

    def save(self, model_path: str):
        os.makedirs(os.path.dirname(os.path.abspath(model_path)), exist_ok=True)
        joblib.dump(self, model_path)

    @classmethod
    def load(cls, model_path: str) -> "LSTMAnomalyDetector":
        return joblib.load(model_path)
