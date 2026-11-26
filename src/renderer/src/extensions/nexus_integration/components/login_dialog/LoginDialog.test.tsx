import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  login: vi.fn(),
  oauthPending: undefined as string | undefined,
}));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ session: { nexus: { oauthPending: mocks.oauthPending } } }),
}));
vi.mock("@/views/components/Header/premium/useNexusLogin.hook", () => ({
  useNexusLogin: () => mocks.login,
}));

import { setOauthPending } from "../../actions/session";
import { LoginDialog, type ILoginDialogProps } from "./LoginDialog";

const URL = "https://users.nexusmods.com/oauth/authorize?x=1";

const renderDialog = (overrides: Partial<ILoginDialogProps> = {}) => {
  const props: ILoginDialogProps = {
    visible: false,
    onHide: vi.fn(),
    onCancelLogin: vi.fn(),
    onReceiveCode: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  render(<LoginDialog {...props} />);
  return props;
};

const token = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64");

describe("LoginDialog", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.login.mockReset();
    mocks.oauthPending = undefined;
  });

  it("stays closed when nothing asked for it", () => {
    renderDialog();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers to log in when opened before a login has started", async () => {
    renderDialog({ visible: true });

    await userEvent.click(screen.getByTestId("login-dialog-login"));

    expect(mocks.login).toHaveBeenCalledOnce();
  });

  it("shows the progress and the address while a login waits on the website", async () => {
    mocks.oauthPending = URL;
    renderDialog();

    expect(await screen.findByText("login_dialog::progress::title")).toBeInTheDocument();
    expect(screen.getByTestId("login-spinner")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "login_dialog::address" })).toHaveValue(URL);
  });

  it("cancels the login when closed", async () => {
    mocks.oauthPending = URL;
    const props = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(mocks.dispatch).toHaveBeenCalledWith(setOauthPending(undefined));
    expect(props.onCancelLogin).toHaveBeenCalledOnce();
    expect(props.onHide).toHaveBeenCalledOnce();
  });

  it("cancels the login on Escape", async () => {
    mocks.oauthPending = URL;
    const props = renderDialog();
    await screen.findByText("login_dialog::progress::title");

    await userEvent.keyboard("{Escape}");

    expect(props.onCancelLogin).toHaveBeenCalledOnce();
  });

  it("keeps the login going when the user clicks outside the dialog", async () => {
    mocks.oauthPending = URL;
    const props = renderDialog();
    await screen.findByText("login_dialog::progress::title");

    await userEvent.click(document.querySelector(".nxm-modal-overlay") as Element);

    expect(props.onCancelLogin).not.toHaveBeenCalled();
    expect(props.onHide).not.toHaveBeenCalled();
  });

  it("says when logging in with a readable token fails, rather than blaming the token", async () => {
    mocks.oauthPending = URL;
    const props = renderDialog({
      onReceiveCode: vi.fn(() => Promise.reject(new Error("network down"))),
    });

    await userEvent.click(screen.getByTestId("login-with-token"));
    await userEvent.type(
      screen.getByTestId("login-token-input"),
      token({ authorization_code: "code", state: "s" }),
    );
    await userEvent.click(screen.getByTestId("login-token-save"));

    expect(await screen.findByText("login_dialog::token::failed")).toBeInTheDocument();
    expect(screen.queryByText("login_dialog::token::invalid")).not.toBeInTheDocument();
    expect(props.onHide).not.toHaveBeenCalled();
  });

  it("completes the login with a pasted token", async () => {
    mocks.oauthPending = URL;
    const props = renderDialog();

    await userEvent.click(screen.getByTestId("login-with-token"));
    await userEvent.type(
      screen.getByTestId("login-token-input"),
      token({ authorization_code: "code", state: "s" }),
    );
    await userEvent.click(screen.getByTestId("login-token-save"));

    expect(props.onReceiveCode).toHaveBeenCalledWith("code", "s");
    expect(props.onHide).toHaveBeenCalledOnce();
  });

  it("says when a pasted token isn't recognised", async () => {
    mocks.oauthPending = URL;
    const props = renderDialog();

    await userEvent.click(screen.getByTestId("login-with-token"));
    await userEvent.type(screen.getByTestId("login-token-input"), "not-a-token");
    await userEvent.click(screen.getByTestId("login-token-save"));

    expect(screen.getByText("login_dialog::token::invalid")).toBeInTheDocument();
    expect(props.onReceiveCode).not.toHaveBeenCalled();
    expect(props.onHide).not.toHaveBeenCalled();
  });
});
