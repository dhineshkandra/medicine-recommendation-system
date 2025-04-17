// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

admin.initializeApp();

// Load datasets
const drugRecommendations = require('./data/drug_recommendations.json');
const drugInteractions = require('./data/drug_interactions.json');

// Initialize BioBERT tokenizer (using a simpler approach for Firebase)
const tokenizer = require('./utils/tokenizer');
const labelEncoder = require('./data/label_encoder.json');

// Cache for the model to avoid reloading
let model;

// Function to load the model
async function loadModel() {
  if (!model) {
    console.log('Loading model...');
    model = await tf.loadLayersModel('file://./models/model.json');
    console.log('Model loaded successfully');
  }
  return model;
}

// Preprocess text for the model
function preprocessText(text) {
  // Add "Symptoms: " prefix if not present
  if (!text.toLowerCase().startsWith('symptoms:')) {
    text = 'Symptoms: ' + text;
  }
  
  const tokenized = tokenizer.tokenize(text);
  return {
    input_ids: tf.tensor2d([tokenized.input_ids], [1, tokenized.input_ids.length]),
    attention_mask: tf.tensor2d([tokenized.attention_mask], [1, tokenized.attention_mask.length])
  };
}

// Predict disease from symptoms
async function predictDisease(symptomText) {
  const model = await loadModel();
  const preprocessed = preprocessText(symptomText);
  
  const prediction = model.predict([
    preprocessed.input_ids,
    preprocessed.attention_mask
  ]);
  
  const predictionArray = await prediction.array();
  const maxIndex = predictionArray[0].indexOf(Math.max(...predictionArray[0]));
  const disease = labelEncoder.classes[maxIndex];
  
  return disease;
}

// Get drug recommendations for a disease
function getDrugRecommendations(disease) {
  return drugRecommendations.filter(rec => rec.condition === disease)
    .sort((a, b) => b.weighted_rating - a.weighted_rating);
}

// Check for drug interactions
function checkDrugInteractions(drug) {
  const interactingDrugs = new Set();
  
  // Check when drug is Drug 1
  const interactions1 = drugInteractions.filter(
    interaction => interaction["Drug 1"].toLowerCase() === drug.toLowerCase()
  );
  interactions1.forEach(interaction => interactingDrugs.add(interaction["Drug 2"]));
  
  // Check when drug is Drug 2
  const interactions2 = drugInteractions.filter(
    interaction => interaction["Drug 2"].toLowerCase() === drug.toLowerCase()
  );
  interactions2.forEach(interaction => interactingDrugs.add(interaction["Drug 1"]));
  
  return Array.from(interactingDrugs);
}

// HTTP function for the medicine recommendation API
exports.medicineApi = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  try {
    const symptoms = req.body.symptoms;
    const currentMedications = req.body.currentMedications || [];
    
    if (!symptoms) {
      res.status(400).json({ error: 'No symptoms provided' });
      return;
    }
    
    // Predict disease
    const disease = await predictDisease(symptoms);
    
    // Get drug recommendations
    const recommendations = getDrugRecommendations(disease);
    
    if (recommendations.length === 0) {
      res.json({
        disease,
        message: 'No drug recommendations available for this disease.',
        recommendations: []
      });
      return;
    }
    
    // Process recommendations and check for interactions
    const processedRecommendations = recommendations.map(rec => {
      const drug = rec.drugName;
      const interactingDrugs = checkDrugInteractions(drug);
      const hasConflict = currentMedications.some(med => 
        interactingDrugs.some(
          interactingDrug => interactingDrug.toLowerCase() === med.toLowerCase()
        )
      );
      
      return {
        drug,
        rating: rec.weighted_rating,
        interactions: interactingDrugs,
        hasConflict
      };
    });
    
    // Filter out drugs with conflicts if the user provided current medications
    const safeRecommendations = currentMedications.length > 0 
      ? processedRecommendations.filter(rec => !rec.hasConflict)
      : processedRecommendations;
    
    res.json({
      disease,
      recommendations: safeRecommendations,
      allRecommendations: processedRecommendations
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
