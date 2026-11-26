import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), login: vi.fn() }));

vi.mock("react-redux", () => ({ useDispatch: () => mocks.dispatch }));
vi.mock("@/views/components/Header/premium/useNexusLogin.hook", () => ({
  useNexusLogin: () => mocks.login,
}));

import { suppressNotification } from "@/actions";

import { LOGIN_PROMPT_ID, LoginPrompt } from "./LoginPrompt";

const suppress = suppressNotification(LOGIN_PROMPT_ID, true);

describe("LoginPrompt", () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.login.mockReset();
  });

  it("closes and starts the login when the button is clicked", async () => {
    const onHide = vi.fn();
    render(<LoginPrompt visible onHide={onHide} />);

    await userEvent.click(screen.getByTestId("login-prompt-login"));

    expect(onHide).toHaveBeenCalledOnce();
    expect(mocks.login).toHaveBeenCalledOnce();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("has no X, so it only closes with an answer", async () => {
    render(<LoginPrompt visible onHide={vi.fn()} />);

    expect(await screen.findByTestId("login-prompt-no-thanks")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("stays open on Escape", async () => {
    const onHide = vi.fn();
    render(<LoginPrompt visible onHide={onHide} />);

    await userEvent.keyboard("{Escape}");

    expect(onHide).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("remembers 'Don't show this again' when logging in", async () => {
    render(<LoginPrompt visible onHide={vi.fn()} />);

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByTestId("login-prompt-login"));

    expect(mocks.dispatch).toHaveBeenCalledWith(suppress);
    expect(mocks.login).toHaveBeenCalledOnce();
  });

  it("closes without logging in on 'No, thanks'", async () => {
    const onHide = vi.fn();
    render(<LoginPrompt visible onHide={onHide} />);

    await userEvent.click(screen.getByTestId("login-prompt-no-thanks"));

    expect(onHide).toHaveBeenCalledOnce();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("remembers 'Don't show this again' on 'No, thanks'", async () => {
    const onHide = vi.fn();
    render(<LoginPrompt visible onHide={onHide} />);

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByTestId("login-prompt-no-thanks"));

    expect(mocks.dispatch).toHaveBeenCalledWith(suppress);
    expect(onHide).toHaveBeenCalledOnce();
  });
});
