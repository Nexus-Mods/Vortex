using System.Collections.Generic;
using System.Threading.Tasks;

namespace Components.ModInstaller
{
	public delegate void ProgressDelegate(int percent);

	public interface IInstaller
	{
		#region Mod Installation

		/// <summary>
		/// This will determine whether the program can handle the specific archive.
		/// </summary>
		/// <param name="modArchiveFileList">The list of files inside the mod archive.</param>
		Task<Dictionary<string, object>> TestSupported(List<string> modArchiveFileList);

		/// <summary>
		/// This will simulate the mod installation and decide installation choices and files final paths.
		/// </summary>
		/// <param name="modArchiveFileList">The list of files inside the mod archive.</param>
		/// <param name="destinationPath">The file install destination folder.</param>
		/// <param name="progressDelegate">A delegate to provide progress feedback.</param>
		/// <param name="error_OverwritesDelegate">A delegate to present errors and file overwrite requests.</param>
		/// <param name="userInteractionDelegate">A delegate to present installation choices to the user.</param>
		/// <param name="pluginQueryDelegate">A delegate to query whether a plugin already exists.</param>
		/// <param name="requiredExtenderDelegate">A delegate to query what scripted extender version is installed.</param>
		Task<Dictionary<string, object>> Install(List<string> modArchiveFileList, string destinationPath, ProgressDelegate progressDelegate,
			string error_OverwritesDelegate, string userInteractionDelegate, string pluginQueryDelegate, string requiredExtenderDelegate);

		#endregion
	}
}
