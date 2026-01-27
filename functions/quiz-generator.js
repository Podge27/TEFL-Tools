// --- UPDATED: GENERATE (Preview Only) ---
            generateQuiz: async function() {
                const topic = document.getElementById('ai-topic').value;
                const type = document.getElementById('ai-type').value;
                const btnText = document.getElementById('gen-text');
                const loader = document.getElementById('gen-loader');

                if(!topic) return alert("Please type a topic!");

                btnText.innerText = "Dreaming...";
                loader.classList.remove('hidden');

                try {
                    const response = await fetch('/.netlify/functions/quiz-generator', {
                        method: 'POST',
                        body: JSON.stringify({ 
                            topic: topic, 
                            level: this.state.selectedLevel || 'B1',
                            type: type
                        })
                    });
                    const newQuiz = await response.json();
                    if(newQuiz.error) throw new Error(newQuiz.error);

                    // STOP! We do NOT save to DB yet.
                    // We just flag it as "unsaved" so the UI knows.
                    newQuiz.is_unsaved_preview = true; 
                    newQuiz.is_generated = true;

                    // Start the quiz
                    this.startQuiz(newQuiz);

                } catch (error) {
                    alert("AI Error: " + error.message);
                } finally {
                    btnText.innerText = "Generate";
                    loader.classList.add('hidden');
                }
            },

            // --- NEW: MANUAL SAVE ---
            saveCurrentQuiz: async function() {
                const q = this.state.currentQuiz;
                if(!q) return;

                const btn = document.getElementById('btn-save-cloud');
                btn.innerText = "Saving...";

                // Send to Supabase
                const { error } = await dbClient.from('grammar_quizzes').insert([{ 
                    title: q.title,
                    level: q.level,
                    category: q.category,
                    topic: q.topic,
                    questions: q.questions,
                    is_generated: true
                }]);

                if(error) {
                    alert("Error saving: " + error.message);
                    btn.innerText = "Error ❌";
                } else {
                    // Success!
                    btn.className = "px-4 py-1 rounded-lg bg-gray-100 text-gray-400 font-bold text-xs cursor-default";
                    btn.innerText = "Saved to Library ✅";
                    btn.onclick = null; // Disable button
                    
                    // Add to local list so it shows up if we go back to menu
                    delete q.is_unsaved_preview;
                    allQuizzes.push(q);
                }
            },

            // --- UPDATE: SHOW SAVE BUTTON IN PLAYER ---
            startQuiz: function(quiz) {
                this.state.currentQuiz = quiz;
                this.state.qIdx = 0;
                this.state.score = 0;
                this.switchView('view-player');
                
                // Logic: Only show "Save" button if it's a new AI preview
                const saveBtn = document.getElementById('btn-save-cloud');
                if (quiz.is_unsaved_preview) {
                    saveBtn.classList.remove('hidden');
                    saveBtn.innerText = "☁️ Save to Library";
                    saveBtn.className = "px-4 py-1 rounded-lg bg-green-100 text-green-700 font-bold text-xs hover:bg-green-200 transition flex items-center gap-1";
                    saveBtn.onclick = () => this.saveCurrentQuiz(); // Re-bind click
                } else {
                    saveBtn.classList.add('hidden');
                }

                this.renderQuestion();
            },