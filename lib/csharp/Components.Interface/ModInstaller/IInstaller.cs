using Components.Interface;
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
		/// <param name="coreDelegate">A delegate for all the interactions with the js core.</param>
		Task<Dictionary<string, object>> Install(List<string> modArchiveFileList, string destinationPath, ProgressDelegate progressDelegate,
			CoreDelegates coreDelegate);

		#endregion
	}
}
