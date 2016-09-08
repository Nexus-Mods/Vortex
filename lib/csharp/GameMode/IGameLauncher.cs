using Commands;
using System;
using System.Collections.Generic;
using System.ComponentModel;

namespace GameMode
{
	/// <summary>
	/// Describes the properties and methods of a game launcher.
	/// </summary>
	/// <remarks>
	/// A game launcher exposes commands that the client can use to launch the game whose mods are being managed.
	/// </remarks>
	public interface IGameLauncher
	{
		/// <summary>
		/// Raised when an attempt to launch the game is about to be made.
		/// </summary>
		event CancelEventHandler GameLaunching;

		/// <summary>
		/// Raised when an attempt to launch the game has been made.
		/// </summary>
		/// <seealso cref="GameLaunchEventArgs"/>
		event EventHandler<GameLaunchEventArgs> GameLaunched;

		#region Properties

		/// <summary>
		/// Gets the launch commands that can launch the game.
		/// </summary>
		/// <value>The launch commands that can launch the game.</value>
		IEnumerable<Command> LaunchCommands { get; }

		/// <summary>
		/// Gets the default launch command.
		/// </summary>
		/// <value>The default launch command.</value>
		Command DefaultLaunchCommand { get; }

		#endregion
	}
}
