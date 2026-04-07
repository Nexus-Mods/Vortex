import { provides } from "@vortex/adaptor-api/builder";
import type { IEchoService } from "@vortex/adaptor-api/contracts/ping";
import { ping } from "virtual:services";

@provides("vortex:adaptor/ping-test/echo")
export class EchoService implements IEchoService {
  async echo(data: string): Promise<string> {
    const pong = await ping.ping(data);
    return `echo: ${pong}`;
  }
}
