// Learning Phase browser implementation
(() => {
  // ---------- Constants ----------
  const WORDS = [
    "ardilla", "basurero", "caballo", "cebolla", "cinta", "conejo",
    "cuaderno", "elote", "fresas", "gato", "grapadora", "hongos",
    "lapiz", "lechuga", "loro", "manzana", "naranja", "oso",
    "pato", "pez", "reloj", "sandia", "tijeras", "tiza",
  ];
  const TALKERS = [1, 2, 3, 4, 5, 6];

  // ---------- DOM refs ----------
  const startBtn = document.getElementById('start-btn');
  const downloadBtn = document.getElementById('download-btn');
  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');
  const fixationEl = document.getElementById('fixation');
  const messageEl = document.getElementById('message');
  const imgEl = document.getElementById('stimulus-img');
  const participantInput = document.getElementById('participant-id');

  // ---------- Helpers ----------
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const setStatus = (txt) => statusEl.textContent = txt;
  const setLog = (txt) => logEl.textContent = txt;

  function mulberry32(seed) {
    return function() {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(array, rng) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function parseNumericId(participantId) {
    const digits = participantId.match(/\d+/g);
    if (!digits) return 0;
    return parseInt(digits.join(''), 10);
  }

  function buildSchedule(participantId) {
    const numericId = parseNumericId(participantId);
    const singleRemainder = numericId % 6;
    const nvTalker = singleRemainder === 0 ? 6 : singleRemainder;

    const blocks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const conditionList = numericId % 2 === 0 ? 'A' : 'B';
    const wordCondition = {};
    WORDS.forEach((w, idx) => {
      if (conditionList === 'A') {
        wordCondition[w] = idx < 12 ? 'Single' : 'Multi';
      } else {
        wordCondition[w] = idx < 12 ? 'Multi' : 'Single';
      }
    });

    const exposureOrder = (numericId % 4 === 0 || numericId % 4 === 1)
      ? 'Single-first'
      : 'Multi-first';

    // Item order per participant
    const orderRng = mulberry32(numericId * 1000 + 7);
    const baseOrder = seededShuffle(WORDS, orderRng);
    const singleOrder = baseOrder.filter(w => wordCondition[w] === 'Single');
    const multiOrder = baseOrder.filter(w => wordCondition[w] === 'Multi');

    // Talker rotation for Multi
    const talkerRng = mulberry32(numericId * 1000 + 99);
    const cycleOne = seededShuffle(TALKERS, talkerRng);
    const cycleTwo = seededShuffle(TALKERS, talkerRng);
    const multiTalkerSequence = [...cycleOne, ...cycleTwo]; // length 12

    const blockConditionOrder = (blockNum) => {
      const firstHalf = blockNum <= 6;
      if (exposureOrder === 'Single-first') {
        return firstHalf ? ['Single', 'Multi'] : ['Multi', 'Single'];
      }
      return firstHalf ? ['Multi', 'Single'] : ['Single', 'Multi'];
    };

    const trials = [];
    const talkersByWord = new Map();

    blocks.forEach((block) => {
      const [firstCond, secondCond] = blockConditionOrder(block);
      const orderedWords = [
        ...(firstCond === 'Single' ? singleOrder : multiOrder),
        ...(secondCond === 'Single' ? singleOrder : multiOrder),
      ];
      const multiTalkerForBlock = multiTalkerSequence[block - 1];

      orderedWords.forEach((word) => {
        const cond = wordCondition[word];
        const talker = cond === 'Single' ? nvTalker : multiTalkerForBlock;
        const groupNum = Math.floor(WORDS.indexOf(word) / 6) + 1;
        const session = block <= 6 ? 1 : 2;
        trials.push({
          block,
          group: groupNum,
          condition: cond,
          word,
          talker,
          session,
        });
        if (!talkersByWord.has(word)) talkersByWord.set(word, new Set());
        talkersByWord.get(word).add(talker);
      });
    });

    return {
      numericId,
      nvTalker,
      conditionList,
      exposureOrder,
      multiTalkerSequence,
      trials,
      talkersByWord,
    };
  }

  async function preloadAssets(talkersByWord) {
    const tasks = [];
    const totalItems = WORDS.length + Array.from(talkersByWord.values()).reduce((acc, set) => acc + set.size, 0);
    let loaded = 0;

    const updateProgress = () => {
      const pct = totalItems === 0 ? 100 : ((loaded / totalItems) * 100).toFixed(1);
      setStatus(`準備中: ${loaded}/${totalItems} (${pct}%)`);
    };

    const images = {};
    const sounds = {};

    WORDS.forEach((word) => {
      tasks.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          images[word] = img;
          loaded += 1; updateProgress();
          resolve();
        };
        img.onerror = () => reject(new Error(`画像が見つかりません: images/${word}.jpg`));
        img.src = `images/${word}.jpg`;
      }));
    });

    talkersByWord.forEach((talkerSet, word) => {
      talkerSet.forEach((talker) => {
        tasks.push(new Promise((resolve, reject) => {
          const audio = new Audio();
          audio.preload = 'auto';
          audio.oncanplaythrough = () => {
            if (!sounds[word]) sounds[word] = {};
            sounds[word][talker] = audio;
            loaded += 1; updateProgress();
            resolve();
          };
          audio.onerror = () => reject(new Error(`音声が見つかりません: audio/T${talker}_${word}_normal.wav`));
          audio.src = `audio/T${talker}_${word}_normal.wav`;
        }));
      });
    });

    updateProgress();
    await Promise.all(tasks);
    return { images, sounds };
  }

  function showFixation() {
    imgEl.style.display = 'none';
    messageEl.style.display = 'none';
    fixationEl.style.display = 'block';
  }

  function showMessage(text) {
    imgEl.style.display = 'none';
    fixationEl.style.display = 'none';
    messageEl.textContent = text;
    messageEl.style.display = 'block';
  }

  function showImage(word, images) {
    fixationEl.style.display = 'none';
    messageEl.style.display = 'none';
    imgEl.src = images[word].src;
    imgEl.style.display = 'block';
  }

  function waitForResponse(timeoutMs, audioStartMs) {
    return new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handler);
      };
      const handler = (ev) => {
        if (ev.key === 'Escape') {
          cleanup();
          settled = true;
          resolve({ aborted: true, rt: null });
          return;
        }
        if (!settled) {
          const rtMs = performance.now() - audioStartMs;
          cleanup();
          settled = true;
          resolve({ aborted: false, rt: rtMs / 1000 });
        }
      };
      const timer = setTimeout(() => {
        if (!settled) {
          cleanup();
          settled = true;
          resolve({ aborted: false, rt: null });
        }
      }, timeoutMs);
      document.addEventListener('keydown', handler);
    });
  }

  function buildCsv(results, participantId) {
    const header = ["trial","session","block","group","condition","talker","word","word_count","image_file","audio_file","onset_time","response_time"];
    const rows = [header.join(',')];
    results.forEach((r) => {
      rows.push([
        r.trial,
        r.session,
        r.block,
        r.group,
        r.condition,
        r.talker,
        r.word,
        r.wordCount,
        `${r.word}.jpg`,
        `T${r.talker}_${r.word}_normal.wav`,
        r.onset.toFixed(3),
        r.responseTime === null ? 'NA' : r.responseTime.toFixed(3),
      ].join(','));
    });
    return rows.join('\n');
  }

  async function runExperiment(participantId, schedule, assets) {
    document.body.classList.add('running');
    setStatus('準備ができたらスペースキーで開始してください');
    showMessage('スペースキーで開始');

    // Wait for space to start
    await new Promise((resolve) => {
      const handler = (ev) => {
        if (ev.key === ' ') {
          document.removeEventListener('keydown', handler);
          resolve();
        }
      };
      document.addEventListener('keydown', handler);
    });

    const { trials } = schedule;
    const { images, sounds } = assets;
    const wordCounts = new Map();
    const results = [];
    const expStart = performance.now();
    let prevBlock = null;
    setLog('実験中...');

    for (let i = 0; i < trials.length; i++) {
      const trial = trials[i];

      // 12s between blocks (before the first trial of a new block, except block1)
      if (prevBlock !== null && trial.block !== prevBlock) {
        showFixation();
        setStatus(`次のブロック${trial.block}まで休憩中 (12秒)`);
        await delay(12000);
      }
      prevBlock = trial.block;

      // Present image
      showImage(trial.word, images);
      const onset = (performance.now() - expStart) / 1000;
      await delay(750);

      // Play audio
      const audio = sounds[trial.word][trial.talker];
      audio.currentTime = 0;
      audio.play();
      const audioStart = performance.now();

      // Collect response (max 4.25s after audio onset)
      const { aborted, rt } = await waitForResponse(4250, audioStart);
      if (aborted) {
        setStatus('ESCで中断しました');
        showMessage('中断しました');
        startBtn.disabled = false;
        return { results, aborted: true };
      }

      // Log trial
      const count = (wordCounts.get(trial.word) || 0) + 1;
      wordCounts.set(trial.word, count);
      results.push({
        trial: i + 1,
        session: trial.session,
        block: trial.block,
        group: trial.group,
        condition: trial.condition,
        talker: trial.talker,
        word: trial.word,
        wordCount: count,
        onset,
        responseTime: rt,
      });

      // ITI: only within block; 1s fixed
      const nextTrial = trials[i + 1];
      if (nextTrial && nextTrial.block === trial.block) {
        showFixation();
        setStatus(`ITI 1秒 (trial ${i + 1}/${trials.length})`);
        await delay(1000);
      }
    }

    setStatus('セッション完了。結果をダウンロードできます。');
    showMessage('終了しました。お疲れさまでした。');
    return { results, aborted: false };
  }

  // ---------- Main flow ----------
  startBtn.addEventListener('click', async () => {
    const participantId = participantInput.value.trim();
    if (!participantId) {
      setStatus('参加者IDを入力してください。');
      return;
    }

    startBtn.disabled = true;
    downloadBtn.classList.add('hidden');
    setStatus('スケジュールを作成しています...');
    setLog('');
    try {
      const schedule = buildSchedule(participantId);
      const assets = await preloadAssets(schedule.talkersByWord);
      setStatus('準備完了。準備ができたらスペースキーで開始してください。');
      setLog(`条件リスト: ${schedule.conditionList} / Exposure: ${schedule.exposureOrder} / Single talker: T${schedule.nvTalker}`);
      showMessage('スペースキーで開始');

      const { results, aborted } = await runExperiment(participantId, schedule, assets);
      if (aborted) {
        startBtn.disabled = false;
        return;
      }

      const csv = buildCsv(results, participantId);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      downloadBtn.classList.remove('hidden');
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `learning_phase_${participantId}_all_sessions.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      setStatus('結果をダウンロードしてください');
      setLog(`トライアル数: ${results.length}`);
    } catch (err) {
      console.error(err);
      setStatus(`エラー: ${err.message}`);
      startBtn.disabled = false;
    }
  });
})();
