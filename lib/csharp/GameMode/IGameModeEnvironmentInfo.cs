namespace GameMode
{
	/// <summary>
	/// Information about the game mode's environement.
	/// </summary>
	public interface IGameModeEnvironmentInfo
	{
		#region Properties

		/// <summary>
		/// Gets the path to which mod files should be installed.
		/// </summary>
		/// <value>The path to which mod files should be installed.</value>
		string InstallationPath { get; }

		/// <summary>
		/// Gets the secondary path to which mod files should be installed.
		/// </summary>
		/// <value>The secondary path to which mod files should be installed.</value>
		string SecondaryInstallationPath { get; }

		/// <summary>
		/// Gets the path to the game executable.
		/// </summary>
		/// <value>The path to the game executable.</value>
		string ExecutablePath { get; }

		/// <summary>
		/// Gets the directory where installation information is stored for this game mode.
		/// </summary>
		/// <remarks>
		/// This is where install logs, overwrites, and the like are stored.
		/// </remarks>
		/// <value>The directory where installation information is stored for this game mode.</value>
		string InstallInfoDirectory { get; }

		/// <summary>
		/// Gets the directory where overwrites are stored for this game mode.
		/// </summary>
		/// <value>The directory where overwrites are stored for this game mode.</value>
		string OverwriteDirectory { get; }

		/// <summary>
		/// Gets the path of the directory where this Game Mode's mods are stored.
		/// </summary>
		/// <value>The path of the directory where this Game Mode's mods are stored.</value>
		string ModDirectory { get; }

		/// <summary>
		/// Gets the path of the directory where this Game Mode's mods' cache files are stored.
		/// </summary>
		/// <value>The path of the directory where this Game Mode's mods' cache files are stored.</value>
		string ModCacheDirectory { get; }

		/// <summary>
		/// Gets the path of the directory where this Game Mode's mods' partial download files are stored.
		/// </summary>
		/// <value>The path of the directory where this Game Mode's mods' partial download files are stored.</value>
		string ModDownloadCacheDirectory { get; }

		/// <summary>
		/// Gets the path of the directory where this Game Mode's categories are stored.
		/// </summary>
		/// <value>The path of the directory where this Game Mode's categories are stored.</value>
		string CategoryDirectory { get; }

		#endregion
	}
}
