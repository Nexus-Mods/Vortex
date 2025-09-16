// Base component styles
export const baseComponents = {
  button: 'tw:inline-flex tw:items-center tw:justify-center tw:font-medium tw:border tw:border-transparent tw:focus:outline-none tw:focus:ring-2 tw:focus:ring-offset-2 tw:disabled:opacity-50 tw:disabled:cursor-not-allowed',

  input: 'tw:block tw:w-full tw:border tw:border-gray-300 tw:rounded-md tw:shadow-sm tw:focus:ring-2 tw:focus:border-transparent tw:dark:border-gray-600 tw:dark:bg-gray-800 tw:dark:text-white',

  card: 'tw:bg-white tw:dark:bg-gray-800 tw:border tw:border-gray-200 tw:dark:border-gray-700 tw:rounded-lg tw:shadow-sm',

  modal: 'tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:bg-black tw:bg-opacity-50',

  overlay: 'tw:fixed tw:inset-0 tw:bg-black tw:bg-opacity-25 tw:backdrop-blur-sm',

  container: 'tw:mx-auto tw:px-4 tw:sm:px-6 tw:lg:px-8',

  grid: 'tw:grid tw:gap-4',

  flex: 'tw:flex tw:items-center tw:justify-between'
} as const;

export type BaseComponent = keyof typeof baseComponents;