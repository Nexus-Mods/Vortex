using System;
using System.Drawing;
using FomodInstaller.Interface;

namespace FomodInstaller.Scripting.CSharpScript
{
    /// <summary>
    /// Implements the functions availabe to C# scripts.
    /// </summary>
    public class CSharpScriptFunctionProxy : ScriptFunctionProxy
    {
        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the given values.
        /// </summary>
        /// <param name="scriptedMod">The mod for which the script is running.</param>
        /// <param name="coreDelegates">The Core delegates component.</param>
        public CSharpScriptFunctionProxy(Mod scriptedMod, CoreDelegates coreDelegates)
            : base(scriptedMod, coreDelegates)
        {
        }

        #endregion

        #region File Management

        /// <summary>
        /// Installs the specified file from the mod to the specified location on the file system.
        /// </summary>
        /// <remarks>
        /// This is the legacy form of <see cref="ScriptFunctionProxy.InstallFileFromMod(string, string)"/>. It now just calls
        /// <see cref="ScriptFunctionProxy.InstallFileFromMod(string, string)"/>.
        /// </remarks>
        /// <param name="p_strFrom">The path of the file in the mod to install.</param>
        /// <param name="p_strTo">The path on the file system where the file is to be created.</param>
        /// <returns><c>true</c> if the file was written; <c>false</c> otherwise.</returns>
        /// <seealso cref="ScriptFunctionProxy.InstallFileFromMod(string, string)"/>
        public bool CopyDataFile(string p_strFrom, string p_strTo)
        {
            return InstallFileFromMod(p_strFrom, p_strTo);
        }

        #endregion

        #region UI

        #region Select

        /// <summary>
        /// Displays a selection form to the user.
        /// </summary>
        /// <param name="p_sopOptions">The options from which to select.</param>
        /// <param name="p_strTitle">The title of the selection form.</param>
        /// <param name="p_booSelectMany">Whether more than one item can be selected.</param>
        /// <returns>The indices of the selected items.</returns>
        public int[] Select(SelectOption[] p_sopOptions, string p_strTitle, bool p_booSelectMany)
        {
            bool booHasPreviews = false;
            bool booHasDescriptions = false;
            foreach (SelectOption so in p_sopOptions)
            {
                if (so.Preview != null)
                    booHasPreviews = true;
                if (so.Desc != null)
                    booHasDescriptions = true;
            }
            string[] strItems = new string[p_sopOptions.Length];
            Image[] imgPreviews = booHasPreviews ? new Image[p_sopOptions.Length] : null;
            string[] strDescriptions = booHasDescriptions ? new string[p_sopOptions.Length] : null;
            for (int i = 0; i < p_sopOptions.Length; i++)
            {
                strItems[i] = p_sopOptions[i].Item;
                // ???
                //if (booHasPreviews)
                //	imgPreviews[i] = new ExtendedImage(Mod.GetFile(p_sopOptions[i].Preview));
                if (booHasDescriptions)
                    strDescriptions[i] = p_sopOptions[i].Desc;
            }
            return Select(strItems, imgPreviews, strDescriptions, p_strTitle, p_booSelectMany);
        }

        /// <summary>
        /// Displays a selection form to the user.
        /// </summary>
        /// <remarks>
        /// The items, previews, and descriptions are repectively ordered. In other words,
        /// the i-th item in <paramref name="p_strItems"/> uses the i-th preview in
        /// <paramref name="p_strPreviewPaths"/> and the i-th description in <paramref name="p_strDescriptions"/>.
        /// 
        /// Similarly, the idices return as results correspond to the indices of the items in
        /// <paramref name="p_strItems"/>.
        /// </remarks>
        /// <param name="p_strItems">The items from which to select.</param>
        /// <param name="p_strPreviewPaths">The preview image file names for the items.</param>
        /// <param name="p_strDescriptions">The descriptions of the items.</param>
        /// <param name="p_strTitle">The title of the selection form.</param>
        /// <param name="p_booSelectMany">Whether more than one item can be selected.</param>
        /// <returns>The indices of the selected items.</returns>
        public int[] Select(string[] p_strItems, string[] p_strPreviewPaths, string[] p_strDescriptions, string p_strTitle, bool p_booSelectMany)
        {
            Image[] imgPreviews = null;
            if (p_strPreviewPaths != null)
            {
                imgPreviews = new Image[p_strPreviewPaths.Length];
                // ???
                //for (int i = 0; i < p_strPreviewPaths.Length; i++)
                //	if (!string.IsNullOrEmpty(p_strPreviewPaths[i]))
                //		imgPreviews[i] = new ExtendedImage(Mod.GetFile(p_strPreviewPaths[i]));
            }
            return Select(p_strItems, imgPreviews, p_strDescriptions, p_strTitle, p_booSelectMany);
        }

        /// <summary>
        /// Displays a selection form to the user.
        /// </summary>
        /// <remarks>
        /// The items, previews, and descriptions are repectively ordered. In other words,
        /// the i-th item in <paramref name="p_strItems"/> uses the i-th preview in
        /// <paramref name="p_imgPreviews"/> and the i-th description in <paramref name="p_strDescriptions"/>.
        /// 
        /// Similarly, the idices return as results correspond to the indices of the items in
        /// <paramref name="p_strItems"/>.
        /// </remarks>
        /// <param name="p_strItems">The items from which to select.</param>
        /// <param name="p_imgPreviews">The preview images for the items.</param>
        /// <param name="p_strDescriptions">The descriptions of the items.</param>
        /// <param name="p_strTitle">The title of the selection form.</param>
        /// <param name="p_booSelectMany">Whether more than one item can be selected.</param>
        /// <returns>The indices of the selected items.</returns>
        public int[] Select(string[] p_strItems, Image[] p_imgPreviews, string[] p_strDescriptions, string p_strTitle, bool p_booSelectMany)
        {
            // ??? This will be handled by the user interaction delegate
            //List<Nexus.Client.ModManagement.Scripting.SelectOption> lstOptions = new List<Nexus.Client.ModManagement.Scripting.SelectOption>();
            //for (Int32 i = 0; i < p_strItems.Length; i++)
            //{
            //	string strDescription = p_strDescriptions.IsNullOrEmpty() ? null : p_strDescriptions[i];
            //	Image imgPreview = p_imgPreviews.IsNullOrEmpty() ? null : p_imgPreviews[i];
            //	lstOptions.Add(new Nexus.Client.ModManagement.Scripting.SelectOption(p_strItems[i], false, strDescription, imgPreview));
            //}
            //string[] strSelections = UIManager.Select(lstOptions, p_strTitle, p_booSelectMany);
            //List<Int32> lstSelectionIndices = new List<Int32>();
            //foreach (string strSelection in strSelections)
            //	lstSelectionIndices.Add(Array.IndexOf(p_strItems, strSelection));
            //return lstSelectionIndices.ToArray();

            return null;
        }

        #endregion

        #endregion
    }
}
