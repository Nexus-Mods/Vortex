using System;

namespace Tools
{
	/// <summary>
	/// An event arguments class that indicates a tool want to display a view.
	/// </summary>
	public class DisplayToolViewEventArgs : EventArgs
	{
		#region Properties

		/// <summary>
		/// Gets the tool view to display.
		/// </summary>
		/// <value>The tool view to display.</value>
		public IToolView ToolView { get; private set; }

		/// <summary>
		/// Gets whether the view should be modal.
		/// </summary>
		/// <value>Whether the view should be modal.</value>
		public bool IsModal { get; private set; }

		#endregion

		#region Construtors

		/// <summary>
		/// A simple constructor that initialized the obejct with the given values.
		/// </summary>
		/// <param name="p_tvwToolView">The tool view to display.</param>
		/// <param name="p_booIsModal">Whether the view should be modal.</param>
		public DisplayToolViewEventArgs(IToolView p_tvwToolView, bool p_booIsModal)
		{
			ToolView = p_tvwToolView;
			IsModal = p_booIsModal;
		}

		#endregion
	}
}
