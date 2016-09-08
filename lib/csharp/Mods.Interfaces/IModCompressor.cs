using System.ComponentModel;

namespace Mods
{
	/// <summary>
	/// Describes the properties and methods of a mod compressor.
	/// </summary>
	/// <remarks>
	/// A mod compressor compresses a source folder into a specific mod format.
	/// </remarks>
	public interface IModCompressor
	{
		#region Events

		/// <summary>
		/// Raised when a file has finished being compressed.
		/// </summary>
		event CancelEventHandler FileCompressionFinished;

		#endregion

		/// <summary>
		/// Compresses the specified source folder into a mod file at the specified destination.
		/// </summary>
		/// <remarks>
		/// If the desitnation file exists, it will be overwritten.
		/// </remarks>
		/// <param name="p_strSourcePath">The folder to compress into a mod file.</param>
		/// <param name="p_strDestinationPath">The path of the mod file to create.</param>
		void Compress(string p_strSourcePath, string p_strDestinationPath);
	}
}
