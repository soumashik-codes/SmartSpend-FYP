# SmartSpend – Final Year Project

SmartSpend is a full-stack personal finance web application developed as a Final Year Project for BSc (Hons) Computer Science.

The system allows users to upload bank statement CSV files, review and categorise transactions, view dashboard analytics, detect unusual spending, forecast future balances, run what-if simulations, receive advisor-style financial insights, analyse receipts using OCR, and estimate tax-related deductions.

## Live Demo

Frontend: https://smart-spend-fyp.vercel.app/

Backend: Deployed using Railway

## Architecture

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python, SQLAlchemy
- **Database:** SQLite
- **Analytics:** pandas, NumPy, scikit-learn, statsmodels
- **OCR:** pytesseract, Pillow, Tesseract OCR
- **Deployment:** Vercel frontend and Railway backend
- **Architecture Style:** Decoupled frontend-backend REST API

## Core Features

- Secure user registration and login
- CSV bank statement upload
- Flexible transaction parsing for varied CSV formats
- Duplicate file import detection
- Duplicate transaction row detection
- Automatic transaction categorisation
- Manual category review and update
- Dashboard with income, expense, balance, and category summaries
- Unusual spending detection using Isolation Forest
- Balance forecasting using SARIMAX with fallback handling
- What-if simulation for category spending changes
- SmartSpend Advisor with plain-language financial insights
- Receipt image upload and OCR-based extraction
- Tax estimator for salary and deduction estimates
- User settings/profile access

## Project Status

Final submitted prototype completed for the 6COSC023W Computer Science Final Project.

Most core features were implemented successfully. Receipt OCR extraction and receipt data storage were implemented, but full receipt-to-transaction integration remains a future improvement.

## Notes

SmartSpend is a final-year project prototype and is intended for educational and demonstration purposes.

Forecasts, advisor outputs, anomaly flags, and tax estimates should be treated as guidance only, not official financial, tax, or banking advice.

## Repository Note

Both visible contributors on this repository belong to the same developer. `soumashik-codes` is my GitHub account, and `codebug13` was the Git/VS Code username configured on my local development machine during part of the project. 
