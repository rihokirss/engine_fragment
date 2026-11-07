import { ConnectionHandlers } from "./connection-handlers.mjs";
import { MultithreadingHelper } from "./multithreading-helper.mjs";
class Connection {
  _handlers = new ConnectionHandlers();
  _handleInput;
  _port;
  constructor(handleInput) {
    this._handleInput = handleInput;
  }
  fetchMeshCompute(modelId, list) {
    const helper = MultithreadingHelper;
    const input = helper.getMeshComputeRequest(modelId, list);
    const content = helper.getRequestContent(input);
    this.fetch(input, content);
  }
  fetch(input, content) {
    this._handlers.setupInput(input);
    return new Promise((resolve, reject) => {
      this._handlers.set(input.requestId, reject, resolve);
      this.executeConnection(input, content);
    });
  }
  init(port) {
    this._port = port;
    this.initConnection(port);
  }
  initConnection(connection) {
    connection.onmessage = this.onInput;
  }
  async fetchConnection(_input) {
    if (!this._port) {
      throw new Error("Fragments: Connection not initialized");
    }
    return this._port;
  }
  async executeConnection(input, content) {
    const connectionPort = await this.fetchConnection(input);
    connectionPort.postMessage(input, content);
  }
  async manageOutput(input) {
    const connection = await this.fetchConnection(input);
    input.toMainThread = true;
    connection.postMessage(input);
  }
  onInput = (input) => {
    if (input.data.toMainThread) {
      this._handlers.run(input.data);
      return;
    }
    this.manageInput(input.data);
  };
  async manageConnection(input) {
    try {
      await this._handleInput(input);
    } catch (error) {
      input.errorInfo = error.toString();
      if (error?.name !== "LoadAbortedError") {
        console.error(error);
      }
    }
  }
  async manageInput(input) {
    await this.manageConnection(input);
    await this.manageOutput(input);
  }
}
export {
  Connection
};
//# sourceMappingURL=connection.mjs.map
