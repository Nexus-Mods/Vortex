using System;

namespace Downloader
{
	/// <summary>
	/// Describes the arguments of a completed download event.
	/// </summary>
	public class CompletedDownloadEventArgs : EventArgs
	{
		#region Properties

		/// <summary>
		/// Gets whether the entire file has been downloaded.
		/// </summary>
		/// <value>Whether the entire file has been downloaded.</value>
		public bool GotEntireFile { get; private set; }

		/// <summary>
		/// Gets the path to the downloaded file.
		/// </summary>
		/// <value>The path to the downloaded file.</value>
		public string SavedFileName { get; private set; }

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_booGetEntireFile">Whether the entire file has been downloaded.</param>
		/// <param name="p_strSavedFileName">The path to the downloaded file.</param>
		public CompletedDownloadEventArgs(bool p_booGetEntireFile, string p_strSavedFileName)
		{
			GotEntireFile = p_booGetEntireFile;
			SavedFileName = p_strSavedFileName;
		}

		#endregion
	}
}
