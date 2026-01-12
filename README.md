# Learning Phase

Summary of the browser-based learning phase and logging. Open `index.html` in a modern browser (offline OK). Images are loaded from `images/{word}.jpg`, audio from `audio/T{talker}_{word}_normal.wav`.

## How to run
- Enter a participant ID and click “プリロードして準備” to generate the schedule and preload all assets. After it finishes, start with the space bar.
- Cursor is hidden after start. Only Esc aborts immediately; other keys do not change timing or flow.
- Reload/back actions raise warnings. Do not refresh or use the back button during the task.

## Presentation sequence
- 24 blocks total. Each block has 12 trials with only one condition.
- Order per round: 6 blocks of the first condition, then 6 blocks of the second condition. Round 2 repeats the same order (total: 6 + 6 + 6 + 6 blocks).
- Session 1 = blocks 1-12 (both conditions once). Session 2 = blocks 13-24 (repeat).
- A single instruction screen appears before the first block only (matching the first condition).
- Between blocks, a message prompts the participant to press the space bar to continue (self-paced rest; no fixed duration). A halfway message appears after block 12. ITI inside blocks is 1 s; only the fixation and the top progress bar are shown.
- Within-trial timing (fixed):  
  1) Show image.  
  2) Play audio after 750 ms.  
  3) Wait up to 4.25 s from audio onset for any key. Esc aborts; other keys only log RT and do not alter timing.

## Condition assignment (participant ID)
- 24 counterbalance patterns: list (2) x order (2) x rotation (6).
- Pattern index: `patternIndex = (ID - 1) % 24`
- Rotation: `rotationIndex = patternIndex % 6` -> start talker `T[rotationIndex]` (T1..T6). Single and Multi use the same rotation start.
- Order: `orderIndex = floor(patternIndex / 6) % 2` -> Single-first if 0, else Multi-first.
- List assignment: `listIndex = floor(patternIndex / 12) % 2` -> Condition A if 0 (LIST1 = Single, LIST2 = Multi), Condition B if 1 (LIST1 = Multi, LIST2 = Single).
- Multi talkers: rotate [1..6] so it starts at the same talker as Single, then repeat twice (12 Multi blocks).
- Item order: seed-shuffle words within each condition once per participant and repeat that order across all 12 encounters of that condition.

## Check block order for a specific ID
Use the formulas above, or run this snippet in the browser console (open `index.html`, press F12):

```js
const id = 1; // participant ID
const TALKERS = [1, 2, 3, 4, 5, 6];
const patternIndex = (id - 1) % 24;
const rotationIndex = patternIndex % 6;
const orderIndex = Math.floor(patternIndex / 6) % 2;
const listIndex = Math.floor(patternIndex / 12) % 2;

const order = orderIndex === 0 ? ['Single', 'Multi'] : ['Multi', 'Single'];
const startTalker = TALKERS[rotationIndex];
const cycle = TALKERS.slice(rotationIndex).concat(TALKERS.slice(0, rotationIndex));
const multiTalkers = cycle.concat(cycle);

const blocks = [];
let multiIndex = 0;
for (let round = 1; round <= 2; round += 1) {
  for (const condition of order) {
    for (let i = 1; i <= 6; i += 1) {
      blocks.push({
        block: blocks.length + 1,
        round,
        condition,
        talker: condition === 'Single' ? startTalker : multiTalkers[multiIndex++],
      });
    }
  }
}

console.log({
  list: listIndex === 0 ? 'A' : 'B',
  order: orderIndex === 0 ? 'Single-first' : 'Multi-first',
  startTalker,
});
console.table(blocks);
```

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
