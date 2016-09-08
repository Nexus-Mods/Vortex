using System;

namespace GameMode
{
	/// <summary>
	/// The arguments for events signalling that a game launch has been attempted.
	/// </summary>
	public class GameLaunchEventArgs : EventArgs
	{
		#region Properties

		/// <summary>
		/// Gets whether the game was launched.
		/// </summary>
		/// <value>Whether the game was launched.</value>
		public bool Launched { get; private set; }

		/// <summary>
		/// Gets the message about the game launch.
		/// </summary>
		/// <value>The message about the game launch.</value>
		public string Message { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_booGameLaunched">Whether the game was launched.</param>
		/// <param name="p_strMessage">The message about the game launch.</param>
		public GameLaunchEventArgs(bool p_booGameLaunched, string p_strMessage)
		{
			Launched = p_booGameLaunched;
			Message = p_strMessage;
		}

		#endregion
	}
}
