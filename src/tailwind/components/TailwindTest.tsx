import * as React from "react";

export interface ITailwindTestProps {
  // Add any props you might need
}

export const TailwindTest: React.ComponentType<ITailwindTestProps> = (
  props,
) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-lg m-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        🎉 Tailwind v4.0 Test
      </h2>
      <div className="space-y-3">
        <p className="text-gray-600">
          This component uses Tailwind v4 with the "" prefix. It should coexist
          peacefully with your existing Bootstrap/SASS styles.
        </p>

        <button
          className="bg-blue-500 text-white px-4 py-2 rounded transition-colors hover:bg-blue-600 font-medium"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isHovered ? "✨ Hovered!" : "🖱️ Hover me"}
        </button>

        <div className="bg-brand text-white p-3 rounded">
          🎨 Custom brand color from @theme
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-red-100 p-2 rounded text-red-800">
            📦 Grid Item 1
          </div>
          <div className="bg-blue-100 p-2 rounded text-blue-800">
            📦 Grid Item 2
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-500">
            Flexbox + spacing utilities
          </span>
        </div>
      </div>
    </div>
  );
};
