---
name: Who Comes Back? ICU Readmission Prediction
tools: [R, XGBoost, Random Forest, MIMIC-IV, SQL]
image: https://raw.githubusercontent.com/jlattanzi4/icu-readmission-prediction/main/images/ROC_curves.png
description: End-to-end machine learning system predicting 30-day ICU readmissions with 0.683 AUC, delivering $17.25M potential annual value for large academic hospitals.
external_url: https://github.com/jlattanzi4/icu-readmission-prediction
date: 2025-10-22
featured: true
---

# Who Comes Back? Machine Learning for ICU Readmission Prediction

> **Master's Capstone Project** | Bay Path University - M.S. in Applied Data Science

## The Problem

ICU discharge is not the end of the story. For 20% of patients, it's the beginning of a dangerous and costly cycle. Despite $26 billion in annual readmission costs and penalties for hospitals, predicting which patients will return remains an unsolved challenge.

## The Solution

I developed an end-to-end machine learning system using the MIMIC-IV dataset (545,316 hospital admissions from 2008-2019) to predict 30-day ICU readmissions, achieving:

- **0.683 AUC** on held-out test data (49% better than baseline)
- **$17.25M annual net benefit** potential for large academic hospitals
- **280% ROI** with screening efficiency of 13 patients per readmission prevented
- **52.5% of readmissions captured** in highest-risk 33% of patients

### Key Features

- **Massive Data Engineering**: Processed 150+ million raw data points across 6 interconnected database tables
- **Advanced Feature Engineering**: Created 57 clinical features spanning comorbidity indices, healthcare utilization, medication risk, and clinical complexity
- **Rigorous Validation**: Temporal train/test split (2008-2017 training, 2018-2019 testing) prevents data leakage
- **Model Comparison**: Evaluated Logistic Regression, Random Forest, and XGBoost - XGBoost won with 68.9% sensitivity
- **Actionable Risk Stratification**: Top 33% of patients contain 52.5% of readmissions, enabling targeted interventions
- **Financial Analysis**: Comprehensive cost-benefit modeling showing strong ROI

## Technical Highlights

### Technologies Used
- **R & RMarkdown**: Primary development environment (5,000+ lines of code)
- **tidyverse**: Data manipulation (dplyr, tidyr, purrr)
- **caret & xgboost**: Model training and hyperparameter tuning
- **SQL**: Complex multi-table database queries on MIMIC-IV
- **Statistical Methods**: ROC curves, calibration analysis, fairness metrics, cost-benefit modeling

### The Approach

**Data Engineering:**
- Complex SQL joins linking patients, admissions, diagnoses, medications, procedures, and lab results
- Engineered features for comorbidity burden (Charlson & Elixhauser scores), healthcare utilization patterns, polypharmacy risk, and clinical complexity
- Handled missing data and class imbalance with SMOTE

**Model Development:**
- Compared three approaches: Logistic Regression (0.652 AUC), Random Forest (0.671 AUC), XGBoost (0.683 AUC)
- XGBoost identified 7 out of 10 readmissions correctly
- Top predictors: medication count, age, length of stay, hospital mortality flags

**Business Impact:**
- Risk stratification enables efficient resource allocation
- 50% more efficient than random intervention
- Delivers substantial financial value with 280% ROI

## Critical Limitations

- **Generalizability**: Single-center data limits applicability to other hospitals
- **Missing Variables**: No post-discharge factors (housing, medication adherence, caregiver support)
- **Fairness Concerns**: 11 percentage point sensitivity disparity between Black and White patients requiring group-specific calibration
- **Next Steps**: Requires prospective validation, randomized pilot testing, and fairness monitoring before clinical deployment

## What I Learned

- **End-to-end ML pipeline**: From complex data engineering to deployment-ready model
- **Healthcare analytics**: Working with real-world medical data and clinical workflows
- **Algorithmic fairness**: Identifying and addressing bias in predictive models
- **Stakeholder communication**: Translating technical results for clinical and administrative audiences
- **Health economics**: Cost-benefit analysis and ROI calculations for healthcare interventions

## Project Materials

- **[Full Analysis (HTML Report)](https://raw.githubusercontent.com/jlattanzi4/icu-readmission-prediction/main/Capstone_Analysis_FINAL.html)** - Complete analysis with code, visualizations, and results
- **[R Markdown Source](https://raw.githubusercontent.com/jlattanzi4/icu-readmission-prediction/main/Capstone_Analysis_FINAL.Rmd)** - Reproducible analysis code
- **[Abstract](https://raw.githubusercontent.com/jlattanzi4/icu-readmission-prediction/main/Capstone_Abstract.txt)** - 250-word project summary
- **[Presentation Slides](https://raw.githubusercontent.com/jlattanzi4/icu-readmission-prediction/main/FINAL_PRESENTATION_COMPLETE.md)** - Complete slide deck
- **[Video Presentation](https://youtu.be/Le1AnfCN2xI)** - 30-minute capstone defense

## Links

- **[GitHub Repository](https://github.com/jlattanzi4/icu-readmission-prediction)** - Full source code, HTML report, and documentation
- **[Watch Presentation](https://youtu.be/Le1AnfCN2xI)** - Video walkthrough of the project
- **[MIMIC-IV Database](https://physionet.org/content/mimiciv/)** - Source dataset (requires credentialed access)

---

**Dataset**: MIMIC-IV (Medical Information Mart for Intensive Care IV), Beth Israel Deaconess Medical Center
**Citation**: Johnson, A., et al. (2023). MIMIC-IV (version 2.2). PhysioNet. https://doi.org/10.13026/6mm1-ek67
