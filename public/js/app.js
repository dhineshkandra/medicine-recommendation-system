// public/js/app.js
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Firebase (you'll need to replace this with your Firebase config)
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "your-messaging-sender-id",
    appId: "your-app-id"
  };
  
  firebase.initializeApp(firebaseConfig);
  const functions = firebase.functions();
  
  // DOM Elements
  const symptomForm = document.getElementById('symptomForm');
  const addMedicationBtn = document.getElementById('addMedicationBtn');
  const medicationInputs = document.getElementById('medicationInputs');
  const resultsSection = document.getElementById('results');
  const loader = document.getElementById('loader');
  const resultContent = document.getElementById('resultContent');
  const predictedDisease = document.getElementById('predictedDisease');
  const recommendationsList = document.getElementById('recommendationsList');
  const warningBox = document.getElementById('warningBox');
  const warningText = document.getElementById('warningText');
  
  // Add new medication input field
  addMedicationBtn.addEventListener('click', () => {
    const medicationInput = document.createElement('div');
    medicationInput.className = 'medication-input';
    medicationInput.innerHTML = `
      <input type="text" class="medication" placeholder="Enter medication name">
      <button type="button" class="remove-btn"><i class="fas fa-times"></i></button>
    `;
    
    medicationInputs.appendChild(medicationInput);
    
    // Enable all remove buttons when we have more than one medication input
    const removeButtons = document.querySelectorAll('.remove-btn');
    if (removeButtons.length > 1) {
      removeButtons.forEach(btn => btn.disabled = false);
    }
    
    // Add event listener to newly created remove button
    medicationInput.querySelector('.remove-btn').addEventListener('click', function() {
      medicationInputs.removeChild(medicationInput);
      
      // If only one medication input is left, disable its remove button
      const remainingRemoveButtons = document.querySelectorAll('.remove-btn');
      if (remainingRemoveButtons.length === 1) {
        remainingRemoveButtons[0].disabled = true;
      }
    });
  });
  
  // Handle form submission
  symptomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get symptoms
    const symptoms = document.getElementById('symptoms').value.trim();
    
    // Get current medications
    const medicationElements = document.querySelectorAll('.medication');
    const currentMedications = [];
    medicationElements.forEach(element => {
      const value = element.value.trim();
      if (value) {
        currentMedications.push(value);
      }
    });
    
    // Show results section and loader
    resultsSection.style.display = 'block';
    loader.style.display = 'flex';
    resultContent.style.display = 'none';
    warningBox.style.display = 'none';
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    
    try {
      // Call the Firebase Function
      const medicineApi = firebase.functions().httpsCallable('medicineApi');
      const result = await medicineApi({
        symptoms: symptoms,
        currentMedications: currentMedications
      });
      
      const data = result.data;
      
      // Hide loader and show results
      loader.style.display = 'none';
      resultContent.style.display = 'block';
      
      // Display predicted disease
      predictedDisease.textContent = data.disease;
      
      // Check if recommendations available
      if (!data.recommendations || data.recommendations.length === 0) {
        // No recommendations available
        recommendationsList.innerHTML = `
          <div class="no-recommendations">
            <p>No suitable medications found for this condition that avoid potential interactions with your current medications.</p>
          </div>
        `;
        
        // Show warning if needed
        if (currentMedications.length > 0 && data.allRecommendations && data.allRecommendations.length > 0) {
          warningBox.style.display = 'flex';
          warningText.textContent = 'All potential medications for this condition have interactions with your current medications. Please consult a healthcare professional.';
        }
      } else {
        // Display recommendations
        let recommendationsHTML = '';
        
        data.recommendations.forEach(rec => {
          // Calculate star rating (1-5)
          const starRating = Math.min(5, Math.max(1, Math.round(rec.rating)));
          const stars = '★'.repeat(starRating) + '☆'.repeat(5 - starRating);
          
          recommendationsHTML += `
            <div class="drug-card">
              <div class="drug-name">${rec.drug}</div>
              <div class="drug-rating">
                Rating: ${rec.rating.toFixed(1)}
                <span class="star-rating">${stars}</span>
              </div>
              ${rec.interactions && rec.interactions.length > 0 ? 
                `<div class="interaction-warning">
                  <strong>Note:</strong> May interact with: ${rec.interactions.join(', ')}
                </div>` : ''}
            </div>
          `;
        });
        
        recommendationsList.innerHTML = recommendationsHTML;
        
        // Show disclaimer
        warningBox.style.display = 'flex';
        warningText.innerHTML = 'These recommendations are based on AI analysis and user reviews. <strong>Always consult with a healthcare professional before taking any medication.</strong>';
      }
      
    } catch (error) {
      console.error("Error calling function:", error);
      
      // Hide loader and show error
      loader.style.display = 'none';
      resultContent.style.display = 'block';
      recommendationsList.innerHTML = `
        <div class="error-message">
          <p>Sorry, an error occurred while processing your request. Please try again later.</p>
        </div>
      `;
    }
  });
});
