document.addEventListener('DOMContentLoaded', async () => {
  const categorySelect = document.getElementById('category');
  const form = document.getElementById('distributeForm');
  const submitBtn = document.getElementById('submitBtn');
  const statusEl = document.getElementById('status');
  const resultSection = document.getElementById('resultSection');
  const resultList = document.getElementById('result');

  // 加载充值档位
  try {
    const res = await fetch('/api/channels');
    const data = await res.json();
    if (data.success && data.channels.length > 0) {
      renderChannelOptions(data.channels);
    } else {
      showStatus('获取充值档位失败，请稍后再试', 'error');
    }
  } catch (e) {
    showStatus('网络错误，无法加载充值档位', 'error');
  }

  function renderChannelOptions(channels) {
    const groups = {};
    for (const ch of channels) {
      if (!groups[ch.group]) groups[ch.group] = [];
      groups[ch.group].push(ch);
    }
    let html = '<option value="">请选择充值档位</option>';
    for (const [groupName, chs] of Object.entries(groups)) {
      html += `<optgroup label="${groupName}">`;
      for (const ch of chs) {
        html += `<option value="${ch.id}">${ch.name}</option>`;
      }
      html += '</optgroup>';
    }
    categorySelect.innerHTML = html;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const channelId = parseInt(categorySelect.value);
    const quantity = parseInt(document.getElementById('quantity').value) || 1;

    if (!channelId) { showStatus('请先选择充值档位', 'error'); return; }
    if (quantity < 1 || quantity > 50) { showStatus('数量请在 1–50 之间', 'error'); return; }

    submitBtn.disabled = true;
    document.querySelector('.btn-text').hidden = true;
    document.querySelector('.btn-loading').hidden = false;
    showStatus('正在生成卡密，请稍候…', '');

    try {
      const links = [];
      let hasError = false;
      for (let i = 0; i < quantity; i++) {
        const res = await fetch('/api/generate-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId })
        });
        const data = await res.json();
        if (data.success) {
          links.push(data.url);
        } else {
          hasError = true;
          showStatus(`生成失败: ${data.error}`, 'error');
          break;
        }
      }
      if (!hasError && links.length > 0) {
        showResult(links);
        showStatus(`成功生成 ${links.length} 个链接`, 'success');
      }
    } catch (e) {
      showStatus('网络错误，请检查服务器连接', 'error');
    } finally {
      submitBtn.disabled = false;
      document.querySelector('.btn-text').hidden = false;
      document.querySelector('.btn-loading').hidden = true;
    }
  });

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = 'status-msg ' + type;
  }

  function showResult(links) {
    resultSection.hidden = false;
    resultList.innerHTML = '';
    links.forEach((url, i) => {
      const li = document.createElement('li');
      li.className = 'result-item';
      li.innerHTML = `
        <span class="order-num">${i + 1}</span>
        <a class="link-text" href="${url}" target="_blank" rel="noopener">${url}</a>
        <button class="copy-btn" data-url="${url}">复制</button>
      `;
      const copyBtn = li.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(url).then(() => {
          copyBtn.textContent = '已复制';
          copyBtn.classList.add('copied');
          setTimeout(() => { copyBtn.textContent = '复制'; copyBtn.classList.remove('copied'); }, 2000);
        }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.textContent = '已复制';
          copyBtn.classList.add('copied');
          setTimeout(() => { copyBtn.textContent = '复制'; copyBtn.classList.remove('copied'); }, 2000);
        });
      });
      resultList.appendChild(li);
    });
  }

  document.querySelector('[data-copy-all]')?.addEventListener('click', () => {
    const links = Array.from(resultList.querySelectorAll('.link-text'))
      .map(el => el.textContent).join('\n');
    navigator.clipboard.writeText(links).then(() => showToast('已复制全部链接'));
  });

  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2500);
  }
});
