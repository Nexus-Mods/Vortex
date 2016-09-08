using Commands;
using System;
using System.Collections.Generic;
using System.ComponentModel;

namespace GameMode
{
	/// <summary>
	/// Describes the properties and methods of a SupportedTools launcher.
	/// </summary>
	/// <remarks>
	/// A game launcher exposes commands that the client can use to launch the SupportedTools whose mods are being managed.
	/// </remarks>
	public interface ISupportedToolsLauncher
	{
		/// <summary>
		/// Raised when an attempt to launch the SupportedTools is about to be made.
		/// </summary>
		event CancelEventHandler SupportedToolsLaunching;

		/// <summary>
		/// Raised when an attempt to launch the SupportedTools has been made.
		/// </summary>
		/// <seealso cref="GameLaunchEventArgs"/>
		event EventHandler<SupportedToolsLaunchEventArgs> SupportedToolsLaunched;

		/// <summary>
		/// Raised when an attempt to change the SupportedTools path has been made.
		/// </summary>
		event EventHandler ChangedToolPath;

		#region Properties

		/// <summary>
		/// Gets the launch commands that can launch the SupportedTools.
		/// </summary>
		/// <value>The launch commands that can launch the SupportedTools.</value>
		IEnumerable<Command> LaunchCommands { get; }

		/// <summary>
		/// Gets the default launch command.
		/// </summary>
		/// <value>The default launch command.</value>
		Command DefaultLaunchCommand { get; }

		#endregion

		/// <summary>
		/// Initializes the SupportedTools launch commands.
		/// </summary>
		void SetupCommands();

		/// <summary>
		/// Launches the default command if any.
		/// </summary>
		void LaunchDefaultCommand();

		#region Config Commands
		/// <summary>
		/// Configures the selected command.
		/// </summary>
		void ConfigCommand(string p_strCommandID);
		#endregion
	}
}
