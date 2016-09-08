using Commands;
using System;

namespace Tools
{
	/// <summary>
	/// Describes the methods and properties of a game mode tool.
	/// </summary>
	/// <remarks>
	/// A game mode tool provides custom functionality for a specific game mode.
	/// </remarks>
	public interface ITool
	{
		/// <summary>
		/// Notifies listeners that the tool wants a view displayed.
		/// </summary>
		event EventHandler<DisplayToolViewEventArgs> DisplayToolView;

		/// <summary>
		/// Notifies listeners that the tool wants a view closed.
		/// </summary>
		event EventHandler<DisplayToolViewEventArgs> CloseToolView;

		/// <summary>
		/// Gets the command to launch the tool.
		/// </summary>
		/// <value>The command to launch the tool.</value>
		Command LaunchCommand { get; }
	}
}
