/* eslint-env jest */
import * as net from 'net';
import { Readable } from 'stream';
import * as network from '../src/util/network';

function toStream(input)
{
  return new Readable({
    read() {
      this.push(input);
      this.push(null);
    }
  })
}

describe('upload', () => {
  it('uploads data', async () => {
    expect.assertions(2);
    let serv;
    const port = 12345;
    const serveProm = new Promise((resolve) => {
      serv = net.createServer((socket) => {
        socket.setEncoding('utf-8');
        socket.on('data', data => {
          expect(data).toEqual(
            `PUT / HTTP/1.1\r
User-Agent: Vortex\r
Content-Type: application/octet-stream\r
Content-Length: 6\r
Host: localhost:${port}\r
Connection: keep-alive\r
\r
foobar`);
          socket.write('HTTP/1.1 200 OK\r\nConnection: Closed\r\n\r\n');
          socket.end();
        });
      }).listen(port);
      resolve();
    });

    const stream = toStream('foobar');
    await expect(network.upload(`http://localhost:${port}`, stream, 6)).resolves.toEqual(Buffer.alloc(0));
    await serveProm;
    serv.close();
  });
  it('rejects on certificate/connection error', async () => {
    expect.assertions(1);
    const stream = toStream('foobar');
    // Use an unused port to trigger a quick connection error without starting a server
    await expect(network.upload('https://127.0.0.1:65530', stream, 6)).rejects.toEqual(expect.objectContaining({
      code: expect.stringMatching(/^(EPROTO|ECONNRESET|ETIMEDOUT|ECONNREFUSED)$/),
    }));
  }, 10000);
});