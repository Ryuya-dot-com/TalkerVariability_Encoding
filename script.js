// Learning Phase browser implementation
(() => {
  // ---------- Constants ----------
  const LIST1 = [
    "manzana", "oso", "reloj", "tijeras", "sandia", "pato",
    "grapadora", "cinta", "fresas", "tiza", "caballo", "elote",
  ];
  const LIST2 = [
    "hongos", "cebolla", "cuaderno", "ardilla", "loro", "lechuga",
    "lapiz", "conejo", "gato", "naranja", "basurero", "pez",
  ];
  const WORDS = [...LIST1, ...LIST2];
  const TALKERS = [1, 2, 3, 4, 5, 6];

  // ---------- DOM refs ----------
  const preloadBtn = document.getElementById('preload-btn');
  const startBtn = document.getElementById('start-btn');
  const downloadBtn = document.getElementById('download-btn');
  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');
  const fixationEl = document.getElementById('fixation');
  const messageEl = document.getElementById('message');
  const imgEl = document.getElementById('stimulus-img');
  const participantInput = document.getElementById('participant-id');
  const configEl = document.getElementById('config');
  const progressEl = document.getElementById('progress');
  const progressFillEl = document.getElementById('progress-fill');
  const progressLabelEl = document.getElementById('progress-label');

  // Warn on reload/back
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = 'このページを離れると実験が中断されます。本当に移動しますか？';
  });
  if (history && history.pushState) {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => {
      alert('このページを離れると実験が中断されます。戻る操作は使用しないでください。');
      history.pushState(null, '', location.href);
    });
  }

  // ---------- Helpers ----------
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const setStatus = (txt) => statusEl.textContent = txt;
  const setLog = (txt) => logEl.textContent = txt;
  const setStatusLogVisible = (visible) => {
    const displayValue = visible ? '' : 'none';
    statusEl.style.display = displayValue;
    logEl.style.display = displayValue;
  };

  function hideProgress() {
    progressEl.style.display = 'none';
  }

  function showProgressBar(done, total) {
    const pct = total === 0 ? 0 : Math.min(100, Math.max(0, (done / total) * 100));
    progressFillEl.style.width = `${pct}%`;
    progressLabelEl.textContent = `${done}/${total} (${pct.toFixed(1)}%)`;
    progressEl.style.display = 'flex';
  }

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
    // Align Single/Multi assignment to Stimuli_List.xlsx: List1 vs List2
    const wordCondition = {};
    LIST1.forEach((w) => {
      wordCondition[w] = conditionList === 'A' ? 'Single' : 'Multi';
    });
    LIST2.forEach((w) => {
      wordCondition[w] = conditionList === 'A' ? 'Multi' : 'Single';
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
    document.body.classList.add('presenting');
    setStatusLogVisible(false);
  }

  function showMessage(text) {
    document.body.classList.remove('presenting');
    hideProgress();
    imgEl.style.display = 'none';
    fixationEl.style.display = 'none';
    messageEl.textContent = text;
    messageEl.style.display = 'block';
    setStatusLogVisible(true);
  }

  function showImage(word, images) {
    hideProgress();
    fixationEl.style.display = 'none';
    messageEl.style.display = 'none';
    imgEl.src = images[word].src;
    imgEl.style.display = 'block';
    document.body.classList.add('presenting');
    setStatusLogVisible(false);
  }

  let preparedSession = null;

  function enterExperimentScreen() {
    configEl.classList.add('hidden');
    preloadBtn.classList.add('hidden');
    startBtn.classList.add('hidden');
    downloadBtn.classList.add('hidden');
    setStatus('');
    setLog('');
    setStatusLogVisible(true);
  }

  function exitExperimentScreen() {
    configEl.classList.remove('hidden');
    preloadBtn.classList.remove('hidden');
    document.body.classList.remove('running');
    document.body.classList.remove('presenting');
    hideProgress();
    setStatusLogVisible(true);
  }

  function waitForResponse(timeoutMs, audioStartMs) {
    return new Promise((resolve) => {
      let settled = false;
      let firstRt = null;
      const cleanup = () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handler);
      };
      const handler = (ev) => {
        if (ev.key === 'Escape') {
          if (!settled) {
            settled = true;
            cleanup();
            resolve({ aborted: true, rt: null });
          }
          return;
        }
        if (firstRt === null) {
          const rtMs = performance.now() - audioStartMs;
          firstRt = rtMs / 1000;
        }
      };
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve({ aborted: false, rt: firstRt });
        }
      }, timeoutMs);
      document.addEventListener('keydown', handler);
    });
  }

  function buildCsv(results, participantId) {
    const header = ["trial","session","block","group","condition","talker","word","word_count","image_file","audio_file","image_onset_time","audio_onset_time","response_time"];
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
        r.imageOnset.toFixed(3),
        r.audioOnset.toFixed(3),
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

    setStatus('');
    hideProgress();

    const { trials } = schedule;
    const { images, sounds } = assets;
    const wordCounts = new Map();
    const results = [];
    const expStart = performance.now();
    let prevBlock = null;
    setLog('');

    for (let i = 0; i < trials.length; i++) {
      const trial = trials[i];

      // 12s between blocks (before the first trial of a new block, except block1)
      if (prevBlock !== null && trial.block !== prevBlock) {
        showProgressBar(results.length, trials.length);
        showFixation();
        setStatus('');
        await delay(12000);
      }
      prevBlock = trial.block;

      // Present image
      hideProgress();
      setStatus('');
      showImage(trial.word, images);
      const imageOnset = (performance.now() - expStart) / 1000;
      await delay(750);

      // Play audio
      const audio = sounds[trial.word][trial.talker];
      audio.currentTime = 0;
      audio.play();
      const audioStart = performance.now();
      const audioOnset = (audioStart - expStart) / 1000;

      // Collect response (max 4.25s after audio onset)
      const { aborted, rt } = await waitForResponse(4250, audioStart);
      if (aborted) {
        setStatus('ESCで中断しました');
        showMessage('中断しました');
        document.body.classList.remove('running');
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
        imageOnset,
        audioOnset,
        responseTime: rt,
      });

      // ITI: only within block; 1s fixed
      const nextTrial = trials[i + 1];
      if (nextTrial && nextTrial.block === trial.block) {
        showProgressBar(results.length, trials.length);
        showFixation();
        setStatus('');
        await delay(1000);
      }
    }

    setStatus('セッション完了。結果をダウンロードできます。');
    showMessage('終了しました。お疲れさまでした。');
    document.body.classList.remove('running');
    return { results, aborted: false };
  }

  // ---------- Main flow ----------
  preloadBtn.addEventListener('click', async () => {
    const participantId = participantInput.value.trim();
    if (!participantId) {
      setStatus('参加者IDを入力してください。');
      return;
    }

    preloadBtn.disabled = true;
    startBtn.classList.add('hidden');
    startBtn.disabled = true;
    downloadBtn.classList.add('hidden');
    preparedSession = null;
    setStatus('スケジュールを作成しています...');
    setLog('');
    try {
      const schedule = buildSchedule(participantId);
      const assets = await preloadAssets(schedule.talkersByWord);
      preparedSession = { participantId, schedule, assets };
      setStatus('プリロード完了。準備ができたらスペースキーで開始してください。');
      setLog(`条件リスト: ${schedule.conditionList} / Exposure: ${schedule.exposureOrder} / Single talker: T${schedule.nvTalker}`);
      showMessage('スペースキーで開始');
      startBtn.classList.remove('hidden');
      startBtn.disabled = false;
    } catch (err) {
      console.error(err);
      setStatus(`エラー: ${err.message}`);
      preloadBtn.disabled = false;
    }
  });

  startBtn.addEventListener('click', async () => {
    if (!preparedSession) {
      setStatus('先にプリロードを実行してください。');
      return;
    }

    const { participantId, schedule, assets } = preparedSession;
    startBtn.disabled = true;
    enterExperimentScreen();

    try {
      const { results, aborted } = await runExperiment(participantId, schedule, assets);
      exitExperimentScreen();
      startBtn.classList.add('hidden');
      preparedSession = null;

      if (aborted) {
        setStatus('中断しました。必要なら再度プリロードしてください。');
        preloadBtn.disabled = false;
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
      preloadBtn.disabled = false;
    } catch (err) {
      console.error(err);
      setStatus(`エラー: ${err.message}`);
      exitExperimentScreen();
      startBtn.disabled = false;
      preloadBtn.disabled = false;
      preparedSession = null;
    }
  });
})();
