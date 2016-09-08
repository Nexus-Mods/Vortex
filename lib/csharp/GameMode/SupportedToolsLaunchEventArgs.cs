using System;

namespace GameMode
{
	/// <summary>
	/// The arguments for events signalling that a Supported Tools launch has been attempted.
	/// </summary>
	public class SupportedToolsLaunchEventArgs : EventArgs
	{
		#region Properties

		/// <summary>
		/// Gets whether the SupportedTools was launched.
		/// </summary>
		/// <value>Whether the SupportedTools was launched.</value>
		public bool Launched { get; private set; }

		/// <summary>
		/// Gets the message about the SupportedTools launch.
		/// </summary>
		/// <value>The message about the SupportedTools launch.</value>
		public string Message { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_booGameLaunched">Whether the game was launched.</param>
		/// <param name="p_strMessage">The message about the game launch.</param>
		public SupportedToolsLaunchEventArgs(bool p_booSupportedToolsLaunched, string p_strMessage)
		{
			Launched = p_booSupportedToolsLaunched;
			Message = p_strMessage;
		}

		#endregion
	}
}
