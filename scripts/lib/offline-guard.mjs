// Test process only. Child Node processes inherit NODE_OPTIONS; no runtime use.
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';
const blocked = () => { throw new Error('Сетевое обращение запрещено в offline-проверке'); };
globalThis.fetch = blocked;
globalThis.WebSocket = blocked;
net.Socket.prototype.connect = blocked;
http.request = http.get = https.request = https.get = blocked;
dns.lookup = dns.resolve = dns.promises.lookup = dns.promises.resolve = blocked;
syncBuiltinESMExports();
