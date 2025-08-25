import { Middleware, StoreEnhancer } from "redux";

export declare const forwardToMain: Middleware;
export declare const replayActionRenderer: () => void;
export declare const forwardToRenderer: Middleware;
export declare const getInitialStateRenderer: <S = any>() => S | undefined;

// Allow any other legacy named exports to exist without type explosions
export declare const alias: (...args: any[]) => StoreEnhancer;