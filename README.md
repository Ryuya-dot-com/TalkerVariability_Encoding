# Learning Phase

Summary of the browser-based learning phase and logging. Open `index.html` in a modern browser (offline OK). Images are loaded from `images/{word}.jpg`, audio from `audio/T{talker}_{word}_normal.wav`.

## How to run
- Enter a participant ID and click “プリロードして準備” to generate the schedule and preload all assets. After it finishes, start with the space bar.
- Cursor is hidden after start. Only Esc aborts immediately; other keys do not change timing or flow.
- Reload/back actions raise warnings. Do not refresh or use the back button during the task.

## Presentation sequence
- 12 blocks (1–6 = Session 1, 7–12 = Session 2). Each block has 24 trials (all 24 words once).
- 12 s rest between blocks. ITI inside blocks is 1 s; only the fixation and the top progress bar are shown.
- Within-trial timing (fixed):  
  1) Show image.  
  2) Play audio after 750 ms.  
  3) Wait up to 4.25 s from audio onset for any key. Esc aborts; other keys only log RT and do not alter timing.

## Condition assignment (participant ID)
- Even numeric ID → Condition A (LIST1 = Single, LIST2 = Multi). Odd → Condition B (LIST1 = Multi, LIST2 = Single).
- Single talker `nvTalker` = (ID % 6), with 0 replaced by 6.
- Multi talkers: shuffle 1–6 twice with the seeded RNG; assign one talker per block (each talker appears twice across 12 blocks).
- Item order: seed-shuffle the 24 words using the participant ID, split into Single/Multi. Single-first vs Multi-first flips between the first and second half of blocks (decided by ID % 4).

## Logging and CSV
- At the end, download `learning_phase_{participantId}_all_sessions.csv`.  
- Columns: `trial,session,block,group,condition,talker,word,word_count,image_file,audio_file,image_onset_time,audio_onset_time,response_time`  
  - `group`: index of the word in chunks of 6, labeled 1–4.  
  - `word_count`: cumulative presentations of that word.  
  - `image_onset_time`: seconds from experiment start to image onset.  
  - `audio_onset_time`: seconds from experiment start to audio onset.  
  - `response_time`: seconds from audio onset to the first key press; `NA` if no response.  

## UI behavior
- Status text is hidden during stimuli; the progress bar shows only while the fixation is displayed (completed/total trials).  
- On Esc abort, the task stops immediately and CSV includes data up to that point.  

## Requirements
- Modern browser (Chrome/Firefox, offline OK).  
- Audio output enabled.  
