// A workbook the tests can hold in their hand.
//
// The real picker cannot be driven from a test — the 8a spike measured that
// `showOpenFilePicker` fires neither Playwright's `filechooser` event nor CDP's
// `Page.fileChooserOpened`, and the permission bubble is browser UI besides
// (DECISION-LOG 262). So the two pickers are replaced before the app loads and
// hand back a double.
//
// The file lives in localStorage rather than in the origin-private file system:
// OPFS is refused outright on a `file://` origin, which is the same wall
// decision 32 works around. IndexedDB is NOT refused and the app really does
// keep its handle there, so `put` and `get` are patched to carry a marker
// across the structured clone and hand back a live double on the way out.
// Both patches belong to the test; nothing in the app knows it is being watched.
//
// `lastModified` is a counter rather than a clock, because these suites freeze
// time and a frozen clock would leave every write looking simultaneous.

const FILE = 'meridian.xlsx';

async function installLinkStub(page, opts) {
  await page.addInitScript(([name, options]) => {
    /* An init script runs again on every navigation, so the knobs live in
       localStorage: a test that sets `permission` and then reloads is testing a
       new browser session, not a fresh stub. */
    const KNOBS = '__mf:knobs';
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem(KNOBS) || 'null'); } catch (e) { return null; }
    })();
    const state = saved || {
      permission: options.permission || 'granted',
      request: options.request || 'granted',
      failWrite: null,
    };
    state.asks = 0;
    const persist = () => {
      try { localStorage.setItem(KNOBS, JSON.stringify(state)); } catch (e) { /* private mode */ }
    };
    persist();
    window.__link = new Proxy(state, {
      set(target, key, value) { target[key] = value; persist(); return true; },
    });

    const BYTES = '__mf:bytes';
    const STAMP = '__mf:lastModified';

    const readBytes = () => {
      const raw = localStorage.getItem(BYTES);
      return raw ? Uint8Array.from(JSON.parse(raw)) : new Uint8Array(0);
    };
    const readStamp = () => Number(localStorage.getItem(STAMP) || 1000);
    const writeBytes = (u8) => {
      localStorage.setItem(BYTES, JSON.stringify(Array.from(u8)));
      localStorage.setItem(STAMP, String(readStamp() + 1000));
      return readStamp();
    };

    function makeHandle() {
      return {
        __meridianFake: true,
        kind: 'file',
        name,
        queryPermission: async () => state.permission,
        requestPermission: async () => {
          state.asks += 1;
          state.permission = state.request;
          persist();
          return state.request;
        },
        getFile: async () => new File([readBytes()], name, { lastModified: readStamp() }),
        createWritable: async () => {
          if (state.failWrite) {
            const e = new Error('another program is holding the file');
            e.name = state.failWrite;
            throw e;
          }
          const chunks = [];
          return {
            write: async (data) => { chunks.push(data); },
            close: async () => {
              const blob = new Blob(chunks);
              writeBytes(new Uint8Array(await blob.arrayBuffer()));
            },
            abort: async () => {},
          };
        },
      };
    }

    const realPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      return realPut.call(this,
        value && value.__meridianFake ? { __meridianFake: true, name } : value, key);
    };
    const realGet = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      const req = realGet.call(this, key);
      if (this.name !== 'handles') return req;
      return {
        get result() { return req.result && req.result.__meridianFake ? makeHandle() : req.result; },
        set onsuccess(fn) { req.onsuccess = fn; },
        set onerror(fn) { req.onerror = fn; },
      };
    };

    if (options.supported === false) {
      delete window.showOpenFilePicker;
      delete window.showSaveFilePicker;
    } else {
      window.showOpenFilePicker = async () => [makeHandle()];
      window.showSaveFilePicker = async () => makeHandle();
    }

    window.__file = {
      async bytes() { return Array.from(readBytes()); },
      async stat() { return { size: readBytes().length, lastModified: readStamp() }; },
      async put(byteArray) { return writeBytes(Uint8Array.from(byteArray)); },
    };
  }, [FILE, opts || {}]);
}

module.exports = { installLinkStub, FILE };
