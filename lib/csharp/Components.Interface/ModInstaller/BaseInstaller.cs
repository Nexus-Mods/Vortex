using System.Collections.Generic;
using System.Threading.Tasks;

namespace Components.ModInstaller
{
	public abstract class BaseInstaller : IInstaller
	{
		#region Mod Installation

		/// <summary>
		/// This will determine whether the program can handle the specific archive.
		/// </summary>
		/// <param name="ModArchiveFileList">The list of files inside the mod archive.</param>
		/// <param name="RequiredFiles">List of files required by the mod.</param>
		public abstract Task<Dictionary<string, string>> testSupported(List<string> ModArchiveFileList);

		/// <summary>
		/// This will simulate the mod installation and decide installation choices and files final paths.
		/// </summary>
		/// <param name="ModArchiveFileList">The list of files inside the mod archive.</param>
		/// <param name="DestFolder">The file install destination folder.</param>
		/// <param name="ProgressDelegate">A delegate to provide progress feedback.</param>
		/// <param name="Error_OverwritesDelegate">A delegate to present errors and file overwrite requests.</param>
		/// <param name="UserInteractionDelegate">A delegate to present installation choices to the user.</param>
		/// <param name="PluginQueryDelegate">A delegate to query whether a plugin already exists.</param>
		/// <param name="RequiredExtenderDelegate">A delegate to query what scripted extender version is installed.</param>
		/// <param name="ResultMessage">An output message to present the function result.</param>
		public abstract Task<Dictionary<string, string>> Install(List<string> ModArchiveFileList, string DestFolder, string ProgressDelegate,
			string Error_OverwritesDelegate, string UserInteractionDelegate, string PluginQueryDelegate, string RequiredExtenderDelegate);

		#endregion
	}
}
