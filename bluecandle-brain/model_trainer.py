import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

DATA_FILE = "training_dataset.csv"
MODEL_FILE = "bluecandle_model.joblib"

def train_model():
    logging.info(f"Loading dataset from {DATA_FILE}...")
    df = pd.read_csv(DATA_FILE)
    
    # Drop rows with NaN values (which might exist due to rolling calculations at the start of our 60d period)
    initial_len = len(df)
    df.dropna(inplace=True)
    if len(df) < initial_len:
        logging.info(f"Dropped {initial_len - len(df)} rows containing NaN values.")

    # Separate features (X) and labels (y)
    # We must not train on metadata columns or the AI will "cheat"
    ignore_cols = ['signal_id', 'symbol', 'timestamp', 'is_signal']
    feature_cols = [c for c in df.columns if c not in ignore_cols]
    
    X = df[feature_cols]
    y = df['is_signal']
    
    logging.info(f"Training on {len(X)} samples with {len(feature_cols)} features.")
    
    # Split into 80% training data, 20% testing data
    # Stratify ensures both sets have the same ratio of 1s and 0s
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    logging.info(f"Train size: {len(X_train)} | Test size: {len(X_test)}")
    
    # Initialize the Random Forest Classifier
    # We use class_weight='balanced' because we have way more 0s than 1s.
    # This forces the AI to pay extra attention to the rare '1' signals.
    clf = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
    
    logging.info("Training the Random Forest model... (This might take a few seconds)")
    clf.fit(X_train, y_train)
    
    # Test the model on the unseen 20% data
    logging.info("Evaluating model against unseen test data...")
    predictions = clf.predict(X_test)
    
    acc = accuracy_score(y_test, predictions)
    report = classification_report(y_test, predictions)
    cm = confusion_matrix(y_test, predictions)
    
    print("\n" + "="*50)
    print(f" MODEL ACCURACY: {acc * 100:.2f}%")
    print("="*50)
    print("\n--- Confusion Matrix ---")
    print(f"True Negatives:  {cm[0][0]} | False Positives: {cm[0][1]}")
    print(f"False Negatives: {cm[1][0]}  | True Positives:  {cm[1][1]}")
    print("\n--- Classification Report ---")
    print(report)
    print("="*50 + "\n")
    
    # Save the trained model to disk
    joblib.dump(clf, MODEL_FILE)
    
    # Save the feature names so we know exactly what columns the model expects in the future
    joblib.dump(feature_cols, "model_features.joblib")
    
    logging.info(f"Model successfully saved to {MODEL_FILE}")

if __name__ == "__main__":
    train_model()
