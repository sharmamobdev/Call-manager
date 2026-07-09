import { config } from "../config/index.js";
import net from "net";

let socket: net.Socket | null = null;
let commandId = 0;

function connect(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    if (socket && !socket.destroyed) {
      resolve(socket);
      return;
    }

    socket = new net.Socket();
    socket.connect(config.freeswitch.port, config.freeswitch.host, () => {
      socket!.write(`auth ${config.freeswitch.password}\n\n`);
    });

    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      if (buffer.includes("\n\n")) {
        resolve(socket!);
      }
    });

    socket.on("error", reject);
    setTimeout(() => reject(new Error("Freeswitch connection timeout")), 5000);
  });
}

function sendCommand(cmd: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const sock = await connect();
      const id = ++commandId;
      let buffer = "";

      const handler = (data: Buffer) => {
        buffer += data.toString();
        if (buffer.includes("\n\n")) {
          sock.removeListener("data", handler);
          resolve(buffer);
        }
      };

      sock.on("data", handler);
      sock.write(`${cmd}\n\n`);
      setTimeout(() => {
        sock.removeListener("data", handler);
        reject(new Error(`Command timeout: ${cmd}`));
      }, 10000);
    } catch (err) {
      reject(err);
    }
  });
}

export const freeswitch = {
  async originate(params: {
    from: string;
    to: string;
    gateway?: string;
    context?: string;
    dialplan?: string;
  }) {
    const gw = params.gateway ? `sofia/gateway/${params.gateway}/` : "";
    const dialstr = `${gw}${params.to}`;
    const cmd = `bgapi originate ${dialstr} &park()`;
    await connect();
    return sendCommand(cmd);
  },

  async showChannels() {
    return sendCommand("api show channels");
  },

  async sofiaStatus() {
    return sendCommand("api sofia status");
  },

  async reloadAcl() {
    return sendCommand("api reloadacl");
  },

  async reloadXml() {
    return sendCommand("api reloadxml");
  },

  async listGateway(gatewayName: string) {
    return sendCommand(`api sofia gateway ${gatewayName} state`);
  },

  async killCall(uuid: string) {
    return sendCommand(`api uuid_kill ${uuid}`);
  },

  async bridgeCall(uuid: string, destination: string) {
    return sendCommand(`bgapi uuid_transfer ${uuid} ${destination}`);
  },

  async getCdr(callUuid: string) {
    return sendCommand(`api uuid_dump ${callUuid}`);
  },

  dispose() {
    if (socket && !socket.destroyed) {
      socket.write("exit\n\n");
      socket.destroy();
    }
    socket = null;
  },
};
