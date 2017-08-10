using System.Threading;
using System.Drawing;


namespace FomodInstaller.Scripting.ModScript
{
	/// <summary>
	/// This class displays UI elements on another thread.
	/// </summary>
	/// <remarks>
	/// This class is useful for marshalling UI interaction to the UI thread.
	/// </remarks>
	public class ModScriptUIUtil
	{
		#region Constructors

		/// <summary>
		/// A simple constructor that initializes the object with the given values.
		/// </summary>
		/// <param name="p_scxSyncContext">The synchronization context to use to marshall calls to the UI thread.</param>
		public ModScriptUIUtil(SynchronizationContext p_scxSyncContext)
		{
		}

		#endregion

		/// <summary>
		/// Displays text editor, and returns the entered text.
		/// </summary>
		/// <param name="p_strTitle">The title of the editor.</param>
		/// <param name="p_strInitialValue">The initial value of the editor.</param>
		/// <returns>The text entered into the editor.</returns>
		public string GetText(string p_strTitle, string p_strInitialValue)
		{
			string strText = null;
			//SyncContext.Send(x => strText = TextEditor.Show(p_strTitle, p_strInitialValue, false), null);
			return strText;
		}

		/// <summary>
		/// Displays text.
		/// </summary>
		/// <param name="p_strTitle">The title of the editor.</param>
		/// <param name="p_strInitialValue">The initial value of the editor.</param>
		public void ShowText(string p_strTitle, string p_strInitialValue)
		{
			//SyncContext.Send(x => TextEditor.Show(p_strTitle, p_strInitialValue, true), null);
		}

		/// <summary>
		/// Displays the given image.
		/// </summary>
		/// <param name="p_imgImage">The image to display.</param>
		/// <param name="p_strTitle">The title to display in the image viewer.</param>
		public void ShowImage(Image p_imgImage, string p_strTitle)
		{
			//SyncContext.Send(x => ShowImageViewer(p_imgImage, p_strTitle), null);

		}

		/// <summary>
		/// Displays the given image.
		/// </summary>
		/// <remarks>
		/// This method is called by the <see cref="SynchronizationContext"/> so
		/// that the image viewer is created and displayed on the UI thread.
		/// </remarks>
		/// <param name="p_imgImage">The image to display.</param>
		/// <param name="p_strTitle">The title to display in the image viewer.</param>
		private void ShowImageViewer(Image p_imgImage, string p_strTitle)
		{
			//ImageViewer ivwViewer = new ImageViewer();
			//ivwViewer.Image = (Image)p_imgImage;
			//ivwViewer.Text = p_strTitle ?? "Image";
			//ivwViewer.ShowDialog();
		}
	}
}
