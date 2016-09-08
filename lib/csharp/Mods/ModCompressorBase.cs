using System.ComponentModel;

namespace Mods
{
	/// <summary>
	/// This class is subclassed to compress a source folder into a specific mod format.
	/// </summary>
	public abstract class ModCompressorBase : IModCompressor
	{
		#region Events

		/// <summary>
		/// Raised when a file has finished being compressed.
		/// </summary>
		public event CancelEventHandler FileCompressionFinished = delegate { };

		#endregion

		#region Constructors

		/// <summary>
		/// A simple constructor that initializes with its dependencies.
		/// </summary>
		public ModCompressorBase()
		{
		}

		#endregion

		/// <summary>
		/// Compresses the specified source folder into a mod file at the specified destination.
		/// </summary>
		/// <remarks>
		/// If the desitnation file exists, it will be overwritten.
		/// </remarks>
		/// <param name="p_strSourcePath">The folder to compress into a mod file.</param>
		/// <param name="p_strDestinationPath">The path of the mod file to create.</param>
		public abstract void Compress(string p_strSourcePath, string p_strDestinationPath);

		/// <summary>
		/// Raises the <see cref="FileCompressionFinished"/> event.
		/// </summary>
		/// <param name="e">A <see cref="CancelEventArgs"/> describing the event arguments.</param>
		protected void OnFileCompressionFinished(CancelEventArgs e)
		{
			FileCompressionFinished(this, e);
		}
	}
}
