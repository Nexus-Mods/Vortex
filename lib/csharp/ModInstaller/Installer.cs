using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Components.Extensions;
using Utils;

namespace Components.ModInstaller
{
	public class Installer : BaseInstaller
	{
        #region Fields

        protected static FileSystem FileSystem;

        #endregion

        #region Properties

        #endregion

        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the given values.
        /// </summary>
        public Installer()
		{
		}

		#endregion

		#region Mod Installation

		/// <summary>
		/// This will determine whether the program can handle the specific archive.
		/// </summary>
		/// <param name="modArchiveFileList">The list of files inside the mod archive.</param>
		public async override Task<Dictionary<string, string>> TestSupported(List<string> modArchiveFileList)
		{
			Dictionary<string, string> Results = new Dictionary<string, string>();
			bool test = true;
			List<string> RequiredFiles = new List<string>();

			if ((modArchiveFileList != null) && (modArchiveFileList.Count > 0))
				test = false;
			else
			{
				RequiredFiles = await GetRequirements();

				// ??? Do we need to check for mod dependancies here?
			}

			Results.Add("supported", test.ToString());
			if ((RequiredFiles != null) && (RequiredFiles.Count > 0))
			{
				string files = RequiredFiles.Concat(',');
				Results.Add("requiredFiles", files);
			}

			return Results;
		}

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
		public async override Task<Dictionary<string, string>> Install(List<string> modArchiveFileList, string destinationPath, ProgressDelegate progressDelegate,
			string error_OverwritesDelegate, string userInteractionDelegate, string pluginQueryDelegate, string requiredExtenderDelegate)
		{
			List<string> IniEditList = new List<string>();
			List<KeyValuePair<string, string>> FilesToInstall = new List<KeyValuePair<string, string>>();
			Dictionary<string, string> Instructions = new Dictionary<string, string>();


			if (FileSystem.DirectoryExists(destinationPath))
			{
				Instructions.Add("install", "false");
				Instructions.Add("message", "The required folder already exists!");
			}
			else
			{
				// temporary functionality assuming this is a simple install
				FilesToInstall = await BasicModInstall(modArchiveFileList, destinationPath, pluginQueryDelegate, progressDelegate, error_OverwritesDelegate);
			}

			if ((FilesToInstall != null) && (FilesToInstall.Count > 0))
			{
				Instructions.Add("install", "true");
				Instructions.Add("message", "Succesfull!");

				await Task.Run(() =>
				{
					foreach (KeyValuePair<string, string> Kvp in FilesToInstall)
					{
						Instructions.Add(Kvp.Key, Kvp.Value);
					}
				});
			}

			if ((IniEditList != null) && (IniEditList.Count > 0))
			{
				string IniEdits = IniEditList.Concat('@');
				Instructions.Add("iniEdit", IniEdits);
			}
            progressDelegate(100);

			return Instructions;
		}

		#endregion

		#region Requirements

		/// <summary>
		/// This function will return the list of files requirements to complete this mod's installation.
		/// </summary>
		protected async Task<List<string>> GetRequirements()
		{
			List<string> RequiredFilesList = new List<string>();

			//Dummy function
			/*	foreach (ModFormat format in SupportedModFormats)
				{
					if (format.CheckFileList(FileList))
					{
						RequiredFiles = format.GetRequiredFiles();
						break;
					}
				}
			*/

			return RequiredFilesList;
		}

		#endregion

		#region File management

		/// <summary>
		/// This will assign all files to the proper destination.
		/// </summary>
		/// <param name="FileList">The list of files inside the mod archive.</param>
		/// <param name="destinationPath">The file install destination folder.</param>
		/// <param name="pluginQueryDelegate">A delegate to query whether a plugin already exists.</param>
		/// <param name="progressDelegate">A delegate to provide progress feedback.</param>
		/// <param name="error_OverwritesDelegate">A delegate to present errors and file overwrite requests.</param>
		protected async Task<List<KeyValuePair<string, string>>> BasicModInstall(List<string> fileList, string destinationPath, string pluginQueryDelegate, ProgressDelegate progressDelegate, string error_OverwritesDelegate)
		{
			List<KeyValuePair<string, string>> FilesToInstall = new List<KeyValuePair<string, string>>();

			await Task.Run(() =>
			{
				foreach (string ArchiveFile in fileList)
				{
					// the JS code is going to normalize the paths for us, so we don't need any additional checks.
					string FileDestinationPath = Path.Combine(destinationPath, ArchiveFile);

					//Dummy code
					/* if (PluginQueryDelegate.IsPlugin(file))
						if (PluginQueryDelegate.ExsistsPlugin(path))
							then do something about it
					else */ if (FileSystem.FileExists(FileDestinationPath))
					{
						// provide feedback to the user through the Error_OverwritesDelegate
					}

					FilesToInstall.Add(new KeyValuePair<string, string>("source: " + ArchiveFile, "destination:" + FileDestinationPath));
					// Progress should increase.	
				}
			});

			return FilesToInstall;
		}

		#endregion
	}
}
