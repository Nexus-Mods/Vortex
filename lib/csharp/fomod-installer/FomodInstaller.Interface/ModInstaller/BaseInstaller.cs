using FomodInstaller.Interface;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FomodInstaller.ModInstaller
{
	public abstract class BaseInstaller : IInstaller
	{
		#region Mod Installation

		/// <summary>
		/// This will determine whether the program can handle the specific archive.
		/// </summary>
		/// <param name="modArchiveFileList">The list of files inside the mod archive.</param>
		public abstract Task<Dictionary<string, object>> TestSupported(List<string> modArchiveFileList);

		/// <summary>
		/// This will simulate the mod installation and decide installation choices and files final paths.
		/// </summary>
		/// <param name="modArchiveFileList">The list of files inside the mod archive.</param>
    /// <param name="gameSpecificStopFolders">The list of game specific stop folders.</param>
		/// <param name="destinationPath">The file install destination folder.</param>
		/// <param name="progressDelegate">A delegate to provide progress feedback.</param>
		/// <param name="coreDelegate">A delegate for all the interactions with the js core.</param>
    public abstract Task<Dictionary<string, object>> Install(List<string> modArchiveFileList, List<string> gameSpecificStopFolders, string destinationPath, ProgressDelegate progressDelegate,
			CoreDelegates coreDelegate);

		#endregion
	}
}
