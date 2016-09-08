using Archiving;
using Util;

namespace Mods
{
	/// <summary>
	/// Describes the properties and methods of a mod cache manager.
	/// </summary>
	/// <remarks>
	/// A mod cache manager provides information od methods to use the mod cache.
	/// </remarks>
	public interface IModCacheManager
	{
		/// <summary>
		/// Gets or sets the file utility class.
		/// </summary>
		/// <value>The file utility class.</value>
		FileUtil FileUtility { get; }

		/// <summary>
		/// Gets the Mod Cached Directory.
		/// </summary>
		string ModCacheDirectory { get; }

		/// <summary>
		/// Gets the path to the specified mod's cache file.
		/// </summary>
		/// <param name="p_strPath">The path for which to get the cache file.</param>
		/// <returns>The path to the specified mod's cache file.</returns>
		string GetCacheFilePath(string p_strPath);

		/// <summary>
		/// Gets the cache file for the specified mod.
		/// </summary>
		/// <param name="p_modMod">The mod for which to get the cache file.</param>
		/// <returns>The cache file for the specified mod, or <c>null</c>
		/// if there is no cache file.</returns>
		Archive GetCacheFile(IMod p_modMod);

		/// <summary>
		/// Gets the cache file for the specified path.
		/// </summary>
		/// <param name="p_strPath">The path for which to get the cache file.</param>
		/// <returns>The cache file for the specified path, or <c>null</c>
		/// if there is no cache file.</returns>
		Archive GetCacheFile(string p_strPath);

		/// <summary>
		/// Creates a cache file for the given mod, containing the specified files.
		/// </summary>
		/// <param name="p_modMod">The mod for which to create the cache file.</param>
		/// <param name="p_strFilesToCacheFolder">The folder containing the files to put into the cache.</param>
		/// <returns>The cache file for the specified mod, or <c>null</c>
		/// if there were no files to cache.</returns>
		void CreateCacheFile(IMod p_modMod, string p_strFilesToCacheFolder);

		/// <summary>
		/// Migrates the cache zip file for the given mod to the cache folder.
		/// </summary>
		/// <param name="p_modMod">The mod for which to create the cache file.</param>
		void MigrateCacheFile(IMod p_modMod);
	}
}
