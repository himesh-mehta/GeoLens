# SolveNest - Local Setup Guide

Welcome to the SolveNest repository! This document will guide you through setting up the project locally for development and testing.

## 1. Prerequisites & Dependencies

To run this project, you must have the following installed on your machine:
- **Node.js** (v18 or higher) and `npm`
- **Python** (v3.10 or higher)
- **Git**
- **Google Cloud CLI (`gcloud`)** (Required for Earth Engine Authentication)

## 2. Environment Variables & `.env` File

This project uses environment variables to configure the backend and frontend.

1. Locate the `.env.example` file in the root directory.
2. Copy this file and rename the copy to strictly `.env`.
3. Fill in the placeholder values in your new `.env` file with your specific configuration.

**Required Variables:**
- `PORT`: The port the backend will run on (Default: `5000`).
- `GEE_PROJECT_ID`: Your Google Earth Engine Cloud Project ID.
- `NEXT_PUBLIC_API_URL`: The URL the frontend uses to connect to the backend (Default: `http://localhost:5000`).

> [!WARNING]
> NEVER commit your `.env` file to version control. It is already added to `.gitignore` to prevent accidental leaks of your secrets and keys.

## 3. Google Earth Engine Authentication

The backend relies heavily on Google Earth Engine (GEE). You must authenticate your local machine to communicate with the GEE API.

1. Ensure the Google Cloud CLI is installed and configured on your system.
2. Run the following command to log in:
   ```bash
   earthengine authenticate
   ```
3. A browser window will open. Follow the prompts to authenticate using your Google Account that has Earth Engine access enabled.
4. Set the `GEE_PROJECT_ID` in your `.env` file to your specific Earth Engine enabled Google Cloud Project (e.g., `solvenest-earth-engine`).

## 4. Machine Learning Model Artifacts

Due to GitHub's file size limits (100MB), the trained machine learning model files are **not** included in the repository.

You must obtain these two files from your team lead or shared secure storage:
1. `SIH_LandCover_ExtraTrees_Improved.pkl`
2. `SIH_LandCover_RandomForest.pkl`

Once trained or downloaded, place the `.pkl` model file in the following directory:
```
data/results/
```
*(You can also auto-generate the model file by running `python scripts/train_final_model.py`).*

## 5. Starting the Application

The application requires both the Python Backend and the Next.js Frontend to be running simultaneously.

### Start the Backend (Flask)

Open a terminal in the root directory of the project:

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run the server:
   ```bash
   python backend/app.py
   ```
*The backend should now be running on http://localhost:5000*

### Start the Frontend (Next.js)

Open a **new** terminal in the root directory:

```bash
cd frontend
```
1. Install Node modules:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
*The frontend should now be running on http://localhost:3000*

## 6. Verifying the Setup

To ensure everything is working correctly:
1. Open your browser and navigate to `http://localhost:3000`.
2. Ensure the UI loads correctly.
3. Navigate to **Map Explorer** and execute a point or polygon analysis. 
4. If results populate without a timeout or 500 error, your GEE connection and local ML models are correctly configured!
