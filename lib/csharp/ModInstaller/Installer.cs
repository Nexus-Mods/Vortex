using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Components.Extensions;

namespace Components.ModInstaller
{
	public class Installer : BaseInstaller
	{
		#region Properties

		/// <summary>
		/// Gets or sets the mod file list.
		/// </summary>
		/// <value>The mod file list.</value>
		protected List<string> FileList;

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="ModArchiveFileList">The list of files inside the mod archive.</param>
		public Installer(List<string> ModArchiveFileList)
		{
			// ??? Do we want to use the Installer constructor to pass the list or pass the list directly to testSupported and Install?
			if (ModArchiveFileList != null)
				FileList = ModArchiveFileList;
		}

		#endregion

		#region Mod Installation

		/// <summary>
		/// This will determine whether the program can handle the specific archive.
		/// </summary>
		/// <param name="ModArchiveFileList">The list of files inside the mod archive.</param>
		/// <param name="RequiredFiles">List of files required by the mod.</param>
		public async override Task<Dictionary<string, string>> testSupported(List<string> ModArchiveFileList)
		{
			Dictionary<string, string> Results = new Dictionary<string, string>();
			bool test = true;
			List<string> RequiredFiles = new List<string>();

			if ((ModArchiveFileList != null) && (ModArchiveFileList.Count > 0))
				FileList = ModArchiveFileList;
			else
			{
				// ??? Do we want to handle empty lists? Or raise an error in case one is passed?
			}

			if ((FileList != null) && (FileList.Count > 0))
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
		/// <param name="ModArchiveFileList">The list of files inside the mod archive.</param>
		/// <param name="DestFolder">The file install destination folder.</param>
		/// <param name="ProgressDelegate">A delegate to provide progress feedback.</param>
		/// <param name="Error_OverwritesDelegate">A delegate to present errors and file overwrite requests.</param>
		/// <param name="UserInteractionDelegate">A delegate to present installation choices to the user.</param>
		/// <param name="PluginQueryDelegate">A delegate to query whether a plugin already exists.</param>
		/// <param name="RequiredExtenderDelegate">A delegate to query what scripted extender version is installed.</param>
		/// <param name="ResultMessage">An output message to present the function result.</param>
		public async override Task<Dictionary<string, string>> Install(List<string> ModArchiveFileList, string DestFolder, string ProgressDelegate,
			string Error_OverwritesDelegate, string UserInteractionDelegate, string PluginQueryDelegate, string RequiredExtenderDelegate)
		{
			List<string> IniEdits = new List<string>();
			List<KeyValuePair<string, string>> FilesToInstall = new List<KeyValuePair<string, string>>();
			Dictionary<string, string> Instructions = new Dictionary<string, string>();


			if (Directory.Exists(DestFolder))
			{
				Instructions.Add("install", "false");
				Instructions.Add("message", "The required folder already exists!");
			}
			else
			{
				// temporary functionality assuming this is a simple install
				FilesToInstall = await BasicModInstall(ModArchiveFileList, DestFolder, PluginQueryDelegate, ProgressDelegate, Error_OverwritesDelegate);
			}

			if ((FilesToInstall != null) && (FilesToInstall.Count > 0))
			{
				Instructions.Add("install", "true");
				Instructions.Add("message", "Succesfull!");

				await Task.Run(() =>
				{
					foreach (KeyValuePair<string, string> kvp in FilesToInstall)
					{
						Instructions.Add(kvp.Key, kvp.Value);
					}
				});
			}

			if ((IniEdits != null) && (IniEdits.Count > 0))
			{
				string edits = IniEdits.Concat('@');
				Instructions.Add("iniEdit", edits);
			}

			return Instructions;
		}

		#endregion

		#region Requirements

		/// <summary>
		/// This function will return the list of files requirements to complete this mod's installation.
		/// </summary>
		protected async Task<List<string>> GetRequirements()
		{
			List<string> RequiredFiles = new List<string>();

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

			return RequiredFiles;
		}

		#endregion

		#region File management

		/// <summary>
		/// This will assign all files to the proper destination.
		/// </summary>
		/// <param name="FileList">The list of files inside the mod archive.</param>
		/// <param name="DestFolder">The file install destination folder.</param>
		/// <param name="PluginQueryDelegate">A delegate to query whether a plugin already exists.</param>
		/// <param name="ProgressDelegate">A delegate to provide progress feedback.</param>
		/// <param name="Error_OverwritesDelegate">A delegate to present errors and file overwrite requests.</param>
		protected async Task<List<KeyValuePair<string, string>>> BasicModInstall(List<string> FileList, string DestFolder, string PluginQueryDelegate, string ProgressDelegate, string Error_OverwritesDelegate)
		{
			List<KeyValuePair<string, string>> FilesToInstall = new List<KeyValuePair<string, string>>();

			await Task.Run(() =>
			{
				foreach (string file in FileList)
				{
					// the JS code is going to normalize the paths for us, so we don't need any additional checks.
					string path = Path.Combine(DestFolder, file);

					//Dummy code
					/* if (PluginQueryDelegate.IsPlugin(file))
						if (PluginQueryDelegate.ExsistsPlugin(path))
							then do something about it
					else */ if (File.Exists(path))
					{
						// provide feedback to the user through the Error_OverwritesDelegate
					}

					FilesToInstall.Add(new KeyValuePair<string, string>("source: " + file, "destination:" + path));
					// Progress should increase.	
				}
			});

			return FilesToInstall;
		}

		#endregion
	}
}
