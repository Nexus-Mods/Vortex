import type { BrowserWindow, Cookie as ElectronCookie } from "electron";
import { CookieJar, Cookie, Store } from "tough-cookie";

export function createElectronCookieJar(): CookieJar {
  return new CookieJar();
}

export class ElectronCookieStore extends Store {
  override synchronous = false;
  readonly #window: BrowserWindow;

  constructor(window: BrowserWindow) {
    super();
    this.#window = window;
  }

  get #electronCookies() {
    return this.#window.webContents.session.cookies;
  }

  override async getAllCookies(): Promise<Cookie[]> {
    const electronCookies = await this.#electronCookies.get({});
    return electronCookies.map<Cookie>(electronToTough);
  }

  override async findCookie(
    domain?: string | null,
    path?: string | null,
    key?: string | null,
  ): Promise<Cookie | undefined> {
    const electronCookies = await this.#electronCookies.get({
      domain: domain ?? undefined,
      path: path ?? undefined,
      name: key ?? undefined,
    });
    if (electronCookies.length < 1) return undefined;
    const first = electronCookies[0];
    return first !== undefined ? electronToTough(first) : undefined;
  }

  override async findCookies(
    domain: string,
    path: string,
    _allowSpecialUseDomain?: boolean,
  ): Promise<Cookie[]> {
    const electronCookies = await this.#electronCookies.get({
      domain: domain,
      path: path,
    });
    return electronCookies.map<Cookie>(electronToTough);
  }

  override async putCookie(cookie: Cookie): Promise<void> {
    const expires = cookie.expires;
    await this.#electronCookies.set({
      domain: cookie.domain ?? undefined,
      expirationDate: !expires || expires === "Infinity" ? undefined : expires.getTime() / 1000,
      httpOnly: cookie.httpOnly,
      name: cookie.key,
      path: cookie.path ?? undefined,
      sameSite: cookie.sameSite as "unspecified",
      secure: cookie.secure,
      url: cookieUrl(cookie),
      value: cookie.value,
    });
  }

  override async updateCookie(_oldCookie: Cookie, newCookie: Cookie): Promise<void> {
    await this.putCookie(newCookie);
  }

  override async removeCookie(domain: string, path: string, key: string): Promise<void> {
    const cookie = await this.findCookie(domain, path, key);
    if (cookie === undefined) return;
    await this.#electronCookies.remove(cookieUrl(cookie), key);
  }

  override async removeCookies(domain: string, path: string): Promise<void> {
    const cookies = await this.findCookies(domain, path);
    await Promise.all(cookies.map((c) => this.#electronCookies.remove(cookieUrl(c), c.key)));
  }

  override removeAllCookies(): Promise<void> {
    return Promise.reject(new Error("not supported by the electron store"));
  }
}

// Electron/Chromium requires a source URL for cookie storage.
// Strip leading dot from domain cookies (`.example.com` → `example.com`).
function cookieUrl(cookie: Cookie): string {
  const scheme = cookie.secure ? "https" : "http";
  const domain = cookie.domain?.replace(/^\./, "") ?? "";
  const path = cookie.path ?? "/";
  return `${scheme}://${domain}${path}`;
}

function electronToTough(electronCookie: ElectronCookie): Cookie {
  const result = new Cookie({
    domain: electronCookie.domain,
    expires:
      electronCookie.expirationDate !== undefined
        ? new Date(electronCookie.expirationDate * 1000)
        : undefined,
    hostOnly: electronCookie.hostOnly,
    httpOnly: electronCookie.httpOnly,
    path: electronCookie.path,
    sameSite: electronCookie.sameSite,
    secure: electronCookie.secure,
  });

  result.key = electronCookie.name;
  result.value = electronCookie.value;

  return result;
}
