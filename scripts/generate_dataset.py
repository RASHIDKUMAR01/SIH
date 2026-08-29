"""
Convenience launcher to regenerate the synthetic AWS anomaly detection dataset.
Usage:
    python scripts/generate_dataset.py --records 25000
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app.simulator.dataset_generator import main

if __name__ == "__main__":
    main()
