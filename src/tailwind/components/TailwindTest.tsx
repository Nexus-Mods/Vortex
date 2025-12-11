import * as React from "react";

export interface ITailwindTestProps {
  // Add any props you might need
}

export const TailwindTest: React.ComponentType<ITailwindTestProps> = (
  props,
) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div className="tw:p-6 tw:max-w-sm tw:mx-auto tw:bg-white tw:rounded-xl tw:shadow-lg tw:m-4">
      <h2 className="tw:text-xl tw:font-bold tw:text-gray-900 tw:mb-4">
        🎉 Tailwind v4.0 Test
      </h2>
      <div className="tw:space-y-3">
        <p className="tw:text-gray-600">
          This component uses Tailwind v4 with the "tw:" prefix. It should
          coexist peacefully with your existing Bootstrap/SASS styles.
        </p>

        <button
          className="tw:bg-blue-500 tw:text-white tw:px-4 tw:py-2 tw:rounded tw:transition-colors hover:tw:bg-blue-600 tw:font-medium"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isHovered ? "✨ Hovered!" : "🖱️ Hover me"}
        </button>

        <div className="tw:bg-brand tw:text-white tw:p-3 tw:rounded">
          🎨 Custom brand color from @theme
        </div>

        <div className="tw:grid tw:grid-cols-2 tw:gap-2">
          <div className="tw:bg-red-100 tw:p-2 tw:rounded tw:text-red-800">
            📦 Grid Item 1
          </div>
          <div className="tw:bg-blue-100 tw:p-2 tw:rounded tw:text-blue-800">
            📦 Grid Item 2
          </div>
        </div>

        <div className="tw:flex tw:items-center tw:space-x-2">
          <div className="tw:w-4 tw:h-4 tw:bg-green-500 tw:rounded-full"></div>
          <span className="tw:text-sm tw:text-gray-500">
            Flexbox + spacing utilities
          </span>
        </div>
      </div>
    </div>
  );
};
