/**
 * This is a testing framework that enables us to test the user idle detection
 * by intercepting the connection between the renderer and the browser and
 * exposing a mocking API for tests.
 *
 * Usage:
 *
 * 1) Include <script src="mock.js"></script> in your file.
 * 2) Set expectations
 *   expect(addMonitor).andReturn((threshold, monitorPtr, callback) => {
 *     // mock behavior
 *   })
 * 3) Call navigator.idle.query()
 *
 * The mocking API is blink agnostic and is designed such that other engines
 * could implement it too. Here are the symbols that are exposed to tests:
 *
 * - function addMonitor(): the main/only function that can be mocked.
 * - function expect(): the main/only function that enables us to mock it.
 * - function close(): disconnects the interceptor.
 * - enum IdleState {IDLE, ACTIVE, LOCKED}: blink agnostic constants.
 */

var service = (async function() {
  let load = Promise.resolve();
  [
    '/resources/chromium/mojo_bindings.js',
    '/resources/chromium/string16.mojom.js',
    '/resources/chromium/idle_manager.mojom.js',
  ].forEach(path => {
    let script = document.createElement('script');
    script.src = path;
    script.async = false;
    load = load.then(() => new Promise(resolve => {
      script.onload = resolve;
    }));
    document.head.appendChild(script);
  });

  return load.then(intercept);
})();

function intercept() {
  let result = new FakeIdleMonitor();

  let binding = new mojo.Binding(blink.mojom.IdleManager, result);
  let interceptor = new MojoInterfaceInterceptor(blink.mojom.IdleManager.name);
  interceptor.oninterfacerequest = (e) => {
    binding.bind(e.handle);
  }

  interceptor.start();

  IdleState.ACTIVE = blink.mojom.IdleState.ACTIVE;
  IdleState.IDLE = blink.mojom.IdleState.IDLE;
  IdleState.LOCKED = blink.mojom.IdleState.LOCKED;

  result.setBinding(binding);
  return result;
}

class FakeIdleMonitor {
  addMonitor(threshold, monitorPtr, callback) {
    return this.handler.addMonitor(threshold, monitorPtr);
  }
  setHandler(handler) {
    this.handler = handler;
    return this;
  }
  setBinding(binding) {
    this.binding = binding;
    return this;
  }
  close() {
    this.binding.close();
  }
}

const IdleState = {
};

function addMonitor(threshold, monitorPtr, callback) {
  throw new Error("expected to be overriden by tests");
}

async function close() {
  let interceptor = await service;
  interceptor.close();
}

function expect(call) {
  return {
    async andReturn(callback) {
      let interceptor = await service;
      let handler = {};
      handler[call.name] = callback;
      interceptor.setHandler(handler);
    }
  }
}