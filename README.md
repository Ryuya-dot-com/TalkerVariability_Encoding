# Learning Phase

Summary of the browser-based learning phase and logging. Open `index.html` in a modern browser (offline OK). Images are loaded from `images/{word}.jpg`, audio from `audio/T{talker}_{word}_normal.wav`.

## How to run
Enter a participant ID and click “プリロードして準備” to generate the schedule and preload all assets. After it finishes, start with the space bar. The cursor is hidden after start; only Esc aborts immediately, and other keys do not change timing or flow. Reload/back actions raise warnings, so do not refresh or use the back button during the task.

## Procedure (report-ready)
Two conditions are presented: Single (no variability) and Multi (high variability), each using 12 Spanish words. The learning phase comprises 24 blocks, and each block contains 12 trials from only one condition. The structure is two rounds; each round includes 6 blocks of the first condition followed by 6 blocks of the second condition (6 + 6 + 6 + 6 blocks total). Session 1 corresponds to blocks 1-12 (both conditions once), and Session 2 corresponds to blocks 13-24 (repeat). Instructions are shown once at the very start to match the first condition, and a halfway message is presented after block 12; between all blocks, participants press the space bar to continue. Within each block, trials are separated by a 1 s fixation ITI, and the top progress bar is visible only during fixation.

## Stimulus presentation timing (fixed)
Each trial proceeds as follows: the image is shown, audio plays after 750 ms, and any key response is collected for up to 4.25 s from audio onset. Esc aborts the task; other keys only log RT and do not alter timing.

## Multi condition detail (talker variability)
Each Multi block uses one talker and remains constant within the block; talker changes only between blocks. Talker order is a rotation of T1..T6 starting at a participant-specific start talker and repeated twice across the 12 Multi blocks. This Multi talker sequence is fixed within a participant, so round 1 and round 2 use the same order.

## Counterbalancing (participant ID)
Counterbalancing uses 24 patterns defined by list (2) x rotation (6) x order (2). The pair index advances every two IDs and is computed as `pairIndex = floor((ID - 1) / 2)`. Rotation is `rotationIndex = pairIndex % 6`, which yields the start talker T1–T6; Single and Multi share the same rotation start. List assignment uses `listIndex = floor(pairIndex / 6) % 2`, giving Condition A when 0 (LIST1 = Single, LIST2 = Multi) and Condition B when 1 (LIST1 = Multi, LIST2 = Single). Order alternates by parity, with odd IDs assigned to Single-first and even IDs assigned to Multi-first to avoid same-day clustering. Item order is seed-shuffled once per participant within each condition and repeated across all 12 encounters of that condition.

## Worked example (ID = 1)
For ID = 1, the condition list is A (LIST1 = Single, LIST2 = Multi), the order is Single-first (6 Single blocks then 6 Multi blocks, repeated), the Single talker is T1 for all Single blocks, and the Multi talker sequence by block is T1, T2, T3, T4, T5, T6, then repeated T1..T6.

## Check block order for a specific ID
Use the formulas above, or run this snippet in the browser console (open `index.html`, press F12):

```js
const id = 1; // participant ID
const TALKERS = [1, 2, 3, 4, 5, 6];
const pairIndex = Math.floor((id - 1) / 2);
const rotationIndex = pairIndex % 6;
const listIndex = Math.floor(pairIndex / 6) % 2;
const orderIndex = id % 2 === 0 ? 1 : 0;

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
At the end, download `learning_phase_{participantId}_all_sessions.csv`. The CSV columns are `trial,session,block,group,condition,talker,word,word_count,image_file,audio_file,image_onset_time,audio_onset_time,response_time`. The `group` field indexes the word in chunks of six and is labeled 1–4, `word_count` is the cumulative presentation count for that word, `image_onset_time` is the time (seconds) from experiment start to image onset, `audio_onset_time` is the time (seconds) from experiment start to audio onset, and `response_time` is the time (seconds) from audio onset to the first key press (NA if no response).

## UI behavior
Status text is hidden during stimuli, and the progress bar shows only while the fixation is displayed (completed/total trials). On Esc abort, the task stops immediately and the CSV includes data up to that point.

## Requirements
A modern browser (Chrome/Firefox, offline OK) with audio output enabled is required.
