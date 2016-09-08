using Mods;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Util;
using Util.Collections;
using Util.Transactions;

namespace Installer.Logging
{
	public partial class InstallLog : IDisposable
	{
		/// <summary>
		/// Tracks the changes made to an <see cref="InstallLog"/> in the scope of a single
		/// <see cref="Transaction"/>. This also provides the means to commit and rollback the
		/// tracked changes.
		/// </summary>
		private class TransactionEnlistment : IEnlistmentNotification, IDisposable
		{
			private ActiveModRegistry m_amrModKeys = new ActiveModRegistry();

			private InstalledItemDictionary<string, object> m_dicInstalledFiles = null;
			private InstalledItemDictionary<string, object> m_dicUninstalledFiles = null;

			private InstalledItemDictionary<IniEdit, string> m_dicInstalledIniEdits = null;
			private InstalledItemDictionary<IniEdit, string> m_dicReplacedIniEdits = null;
			private InstalledItemDictionary<IniEdit, string> m_dicUninstalledIniEdits = null;

			private InstalledItemDictionary<string, byte[]> m_dicInstalledGameSpecificValueEdits = null;
			private InstalledItemDictionary<string, byte[]> m_dicReplacedGameSpecificValueEdits = null;
			private InstalledItemDictionary<string, byte[]> m_dicUninstalledGameSpecificValueEdits = null;

			private Set<string> m_setRemovedModKeys = new Set<string>();
			private bool m_booEnlisted = false;

			#region Properties

			/// <summary>
			/// Gets the transaction into which we are enlisting.
			/// </summary>
			/// <value>The transaction into which we are enlisting.</value>
			protected Transaction CurrentTransaction { get; private set; }

			/// <summary>
			/// Gets the install log whose actions are being transacted.
			/// </summary>
			/// <value>The install log whose actions are being transacted.</value>
			protected InstallLog EnlistedInstallLog { get; private set; }

			#endregion

			#region Constructors

			/// <summary>
			/// A simple constructor that initializes the object with the given values.
			/// </summary>
			/// <param name="p_txTransaction">The transaction into which we are enlisting.</param>
			/// <param name="p_ilgInstallLog">The install log whose actions are being transacted.</param>
			public TransactionEnlistment(Transaction p_txTransaction, InstallLog p_ilgInstallLog)
			{
				CurrentTransaction = p_txTransaction;
				EnlistedInstallLog = p_ilgInstallLog;
				m_dicInstalledFiles = new InstalledItemDictionary<string, object>(StringComparer.OrdinalIgnoreCase);
				m_dicUninstalledFiles = new InstalledItemDictionary<string, object>(StringComparer.OrdinalIgnoreCase);

				m_dicInstalledIniEdits = new InstalledItemDictionary<IniEdit, string>();
				m_dicReplacedIniEdits = new InstalledItemDictionary<IniEdit, string>();
				m_dicUninstalledIniEdits = new InstalledItemDictionary<IniEdit, string>();

				m_dicInstalledGameSpecificValueEdits = new InstalledItemDictionary<string, byte[]>();
				m_dicReplacedGameSpecificValueEdits = new InstalledItemDictionary<string, byte[]>();
				m_dicUninstalledGameSpecificValueEdits = new InstalledItemDictionary<string, byte[]>();
			}

			#endregion

			#region IEnlistmentNotification Members

			/// <summary>
			/// Commits the changes to the install log.
			/// </summary>
			public void Commit()
			{
				//merge registered mods
				foreach (KeyValuePair<IMod, string> kvpMod in m_amrModKeys.Registrations)
					EnlistedInstallLog.m_amrModKeys.RegisterMod(kvpMod.Key, kvpMod.Value, m_amrModKeys.IsModHidden(kvpMod.Key));

				CommitFileChanges();
				CommitIniEditChanges();
				CommitGameSpecificValueEditChanges();

				//remove registered mods
				foreach (string strRemovedModKey in m_setRemovedModKeys)
					EnlistedInstallLog.m_amrModKeys.DeregisterMod(strRemovedModKey);

				EnlistedInstallLog.SaveInstallLog();

				m_booEnlisted = false;
				m_amrModKeys.Clear();
				m_dicInstalledFiles.Clear();
				m_dicInstalledIniEdits.Clear();
				m_dicInstalledGameSpecificValueEdits.Clear();
			}

			/// <summary>
			/// Commits the changes made to installed files.
			/// </summary>
			protected void CommitFileChanges()
			{
				InstalledItemDictionary<string, object> iidFiles = EnlistedInstallLog.m_dicInstalledFiles;
				//merge installed files
				foreach (InstalledItemDictionary<string, object>.ItemInstallers insFile in m_dicInstalledFiles)
				{
					if ((insFile.Installers.Count == 0) || GetModKey(OriginalValueMod).Equals(insFile.Installers.Peek().InstallerKey))
						continue;
					foreach (InstalledValue<object> isvMod in insFile.Installers)
					{
						iidFiles[insFile.Item].Remove(isvMod);
						iidFiles[insFile.Item].Push(isvMod);
					}
				}
				//remove deleted files
				List<string> lstFilesToRemove = new List<string>();
				foreach (InstalledItemDictionary<string, object>.ItemInstallers insFile in m_dicUninstalledFiles)
				{
					if (!iidFiles.ContainsItem(insFile.Item))
						continue;
					iidFiles[insFile.Item].RemoveRange(insFile.Installers);
					if ((iidFiles[insFile.Item].Count == 0) || GetModKey(OriginalValueMod).Equals(iidFiles[insFile.Item].Peek().InstallerKey))
						lstFilesToRemove.Add(insFile.Item);
				}
				//remove all traces of removed mods from installed files
				// this step should be unneccessary, as if a mod has been removed
				// then all of it's files should have been entered in the dictionary
				// of uninstalled files, and already removed.
				// this is here, however, as a safeguard to help ensure the install log
				// doesn't get polluted with old entries.
				foreach (InstalledItemDictionary<string, object>.ItemInstallers insFile in iidFiles)
				{
					foreach (string strRemovedModKey in m_setRemovedModKeys)
						insFile.Installers.Remove(strRemovedModKey);
					if ((insFile.Installers.Count == 0) || GetModKey(OriginalValueMod).Equals(insFile.Installers.Peek().InstallerKey))
						lstFilesToRemove.Add(insFile.Item);
				}
				lstFilesToRemove.ForEach(x => iidFiles.Remove(x));
			}

			/// <summary>
			/// Commits the changes made to Ini file edits.
			/// </summary>
			protected void CommitIniEditChanges()
			{
				InstalledItemDictionary<IniEdit, string> iidIniEdits = EnlistedInstallLog.m_dicInstalledIniEdits;
				//merge installed ini edits
				foreach (InstalledItemDictionary<IniEdit, string>.ItemInstallers insIniEdit in m_dicInstalledIniEdits)
				{
					if ((insIniEdit.Installers.Count == 0) || GetModKey(OriginalValueMod).Equals(insIniEdit.Installers.Peek().InstallerKey))
						continue;
					foreach (InstalledValue<string> isvMod in insIniEdit.Installers)
					{
						iidIniEdits[insIniEdit.Item].Remove(isvMod);
						iidIniEdits[insIniEdit.Item].Push(isvMod);
					}
				}
				//replace replaced ini edits
				foreach (InstalledItemDictionary<IniEdit, string>.ItemInstallers insIniEdit in m_dicReplacedIniEdits)
				{
					if ((insIniEdit.Installers.Count == 0) || GetModKey(OriginalValueMod).Equals(insIniEdit.Installers.Peek().InstallerKey))
						continue;
					foreach (InstalledValue<string> isvMod in insIniEdit.Installers)
						iidIniEdits[insIniEdit.Item].Find(x => x.Equals(isvMod)).Value = isvMod.Value;
				}
				//remove deleted ini edits
				List<IniEdit> lstIniEditsToRemove = new List<IniEdit>();
				foreach (InstalledItemDictionary<IniEdit, string>.ItemInstallers insIniEdit in m_dicUninstalledIniEdits)
				{
					if (!iidIniEdits.ContainsItem(insIniEdit.Item))
						continue;
					iidIniEdits[insIniEdit.Item].RemoveRange(insIniEdit.Installers);
					if ((iidIniEdits[insIniEdit.Item].Count == 0) || GetModKey(OriginalValueMod).Equals(iidIniEdits[insIniEdit.Item].Peek().InstallerKey))
						lstIniEditsToRemove.Add(insIniEdit.Item);
				}
				//remove all traces of removed mods from installed ini edits
				// this step should be unneccessary, as if a mod has been removed
				// then all of it's ini edits should have been entered in the dictionary
				// of uninstalled ini edits, and already removed.
				// this is here, however, as a safeguard to help ensure the install log
				// doesn't get polluted with old entries.
				foreach (InstalledItemDictionary<IniEdit, string>.ItemInstallers insIniEdit in iidIniEdits)
				{
					foreach (string strRemovedModKey in m_setRemovedModKeys)
						insIniEdit.Installers.Remove(strRemovedModKey);
					if ((insIniEdit.Installers.Count == 0) || GetModKey(OriginalValueMod).Equals(insIniEdit.Installers.Peek().InstallerKey))
						lstIniEditsToRemove.Add(insIniEdit.Item);
				}
				lstIniEditsToRemove.ForEach(x => iidIniEdits.Remove(x));
			}

			/// <summary>
			/// Commits the changes made to game specific value edits.
			/// </summary>
			protected void CommitGameSpecificValueEditChanges()
			{
				InstalledItemDictionary<string, byte[]> iidGameSpecificValueEdits = EnlistedInstallLog.m_dicInstalledGameSpecificValueEdits;
				//merge installed game specific value edits
				foreach (InstalledItemDictionary<string, byte[]>.ItemInstallers insGameSpecificValueEdit in m_dicInstalledGameSpecificValueEdits)
				{
					if ((insGameSpecificValueEdit.Installers.Count == 0) || GetModKey(OriginalValueMod).Equals(insGameSpecificValueEdit.Installers.Peek().InstallerKey))
						continue;
					foreach (InstalledValue<byte[]> isvMod in insGameSpecificValueEdit.Installers)
					{
						iidGameSpecificValueEdits[insGameSpecificValueEdit.Item].Remove(isvMod);
						iidGameSpecificValueEdits[insGameSpecificValueEdit.Item].Push(isvMod);
					}
				}
				//replace replaced game specific value edits
				foreach (InstalledItemDictionary<string, byte[]>.ItemInstallers insGameSpecificValueEdit in m_dicReplacedGameSpecificValueEdits)
				{
					if ((insGameSpecificValueEdit.Installers.Count == 0) || GetModKey(OriginalValueMod).Equals(insGameSpecificValueEdit.Installers.Peek().InstallerKey))
						continue;
					foreach (InstalledValue<byte[]> isvMod in insGameSpecificValueEdit.Installers)
						iidGameSpecificValueEdits[insGameSpecificValueEdit.Item].Find(x => x.Equals(isvMod)).Value = isvMod.Value;
				}
				//remove deleted game specific value edits
				List<string> lstGameSpecificValueEditsToRemove = new List<string>();
				foreach (InstalledItemDictionary<string, byte[]>.ItemInstallers insGameSpecificValueEdit in m_dicUninstalledGameSpecificValueEdits)
				{
					if (!iidGameSpecificValueEdits.ContainsItem(insGameSpecificValueEdit.Item))
						continue;
					iidGameSpecificValueEdits[insGameSpecificValueEdit.Item].RemoveRange(insGameSpecificValueEdit.Installers);
					if ((iidGameSpecificValueEdits[insGameSpecificValueEdit.Item].Count == 0) || GetModKey(OriginalValueMod).Equals(iidGameSpecificValueEdits[insGameSpecificValueEdit.Item].Peek().InstallerKey))
						lstGameSpecificValueEditsToRemove.Add(insGameSpecificValueEdit.Item);
				}
				//remove all traces of removed mods from installed game specific value edits
				// this step should be unneccessary, as if a mod has been removed
				// then all of it's game specific value edits should have been entered in the dictionary
				// of uninstalled game specific value edits, and already removed.
				// this is here, however, as a safeguard to help ensure the install log
				// doesn't get polluted with old entries.
				foreach (InstalledItemDictionary<string, byte[]>.ItemInstallers insGameSpecificValueEdit in iidGameSpecificValueEdits)
				{
					foreach (string strRemovedModKey in m_setRemovedModKeys)
						insGameSpecificValueEdit.Installers.Remove(strRemovedModKey);
					if ((insGameSpecificValueEdit.Installers.Count == 0) || GetModKey(OriginalValueMod).Equals(insGameSpecificValueEdit.Installers.Peek().InstallerKey))
						lstGameSpecificValueEditsToRemove.Add(insGameSpecificValueEdit.Item);
				}
				lstGameSpecificValueEditsToRemove.ForEach(x => iidGameSpecificValueEdits.Remove(x));
			}

			/// <summary>
			/// Used to notify an enlisted resource manager that the transaction is being committed.
			/// </summary>
			/// <param name="p_eltEnlistment">The enlistment class used to communicate with the resource manager.</param>
			public void Commit(Enlistment p_eltEnlistment)
			{
				try
				{
					Commit();
					m_dicEnlistments.Remove(CurrentTransaction.TransactionInformation.LocalIdentifier);
					p_eltEnlistment.Done();
				}
				catch (Exception e)
				{
					throw new TransactionException("Problem whilst committing Install Log.", e);
				}
			}

			/// <summary>
			/// Used to notify an enlisted resource manager that the transaction is in doubt.
			/// </summary>
			/// <remarks>
			/// A transaction is in doubt if it has not received votes from all enlisted resource managers
			/// as to the state of the transaciton.
			/// </remarks>
			/// <param name="p_eltEnlistment">The enlistment class used to communicate with the resource manager.</param>
			public void InDoubt(Enlistment p_eltEnlistment)
			{
				Rollback(p_eltEnlistment);
			}

			/// <summary>
			/// Used to notify an enlisted resource manager that the transaction is being prepared for commitment.
			/// </summary>
			/// <param name="p_entPreparingEnlistment">The enlistment class used to communicate with the resource manager.</param>
			public void Prepare(PreparingEnlistment p_entPreparingEnlistment)
			{
				p_entPreparingEnlistment.Prepared();
			}

			/// <summary>
			/// Used to notify an enlisted resource manager that the transaction is being rolled back.
			/// </summary>
			/// <param name="p_eltEnlistment">The enlistment class used to communicate with the resource manager.</param>
			public void Rollback(Enlistment p_eltEnlistment)
			{
				m_booEnlisted = false;
				m_amrModKeys.Clear();
				m_dicInstalledFiles.Clear();
				m_dicInstalledIniEdits.Clear();
				m_dicInstalledGameSpecificValueEdits.Clear();
				m_dicEnlistments.Remove(CurrentTransaction.TransactionInformation.LocalIdentifier);
				p_eltEnlistment.Done();
			}

			#endregion

			/// <summary>
			/// Enlists the install log into the current transaction.
			/// </summary>
			private void Enlist()
			{
				if (!m_booEnlisted)
				{
					CurrentTransaction.EnlistVolatile(this, EnlistmentOptions.None);
					m_booEnlisted = true;
				}
			}

			#region Mod Tracking

			/// <summary>
			/// Adds a mod to the install log, in a transaction.
			/// </summary>
			/// <remarks>
			/// Adding a mod to the install log assigns it a key. Keys are used to track file and
			/// edit versions.
			/// 
			/// If there is no current transaction, the mod is added directly to the install log. Otherwise,
			/// the mod is added to a buffer than can later be committed or rolled back.
			/// </remarks>
			/// <param name="p_modMod">The <see cref="IMod"/> being added.</param>
			/// <param name="p_booIsSpecial">Indicates that the mod is a special mod, internal to the
			/// install log, and show not be included in the list of active mods.</param>
			/// <returns>The key of the added mod.</returns>
			public string AddActiveMod(IMod p_modMod, bool p_booIsSpecial)
			{
				string strKey = GetModKey(p_modMod);
				if (String.IsNullOrEmpty(strKey))
				{
					do
					{
						strKey = Path.GetFileNameWithoutExtension(Path.GetRandomFileName());
					} while (m_amrModKeys.DoesKeyExist(strKey) || EnlistedInstallLog.m_amrModKeys.DoesKeyExist(strKey));
					m_amrModKeys.RegisterMod(p_modMod, strKey, p_booIsSpecial);
					m_setRemovedModKeys.Remove(strKey);
					if (CurrentTransaction == null)
						Commit();
					else
						Enlist();
				}
				return strKey;
			}

			/// <summary>
			/// Replaces a mod in the install log, in a transaction.
			/// </summary>
			/// <remarks>
			/// This replaces a mod in the install log without changing its key.
			/// </remarks>
			/// <param name="p_modOldMod">The mod with to be replaced with the new mod in the install log.</param>
			/// <param name="p_modNewMod">The mod with which to replace the old mod in the install log.</param>
			public void ReplaceActiveMod(IMod p_modOldMod, IMod p_modNewMod)
			{
				if (!m_amrModKeys.IsModRegistered(p_modOldMod) && !EnlistedInstallLog.m_amrModKeys.IsModRegistered(p_modOldMod))
				{
					AddActiveMod(p_modNewMod, false);
					return;
				}

				string strKey = GetModKey(p_modOldMod);
				m_amrModKeys.DeregisterMod(p_modOldMod);
				m_amrModKeys.RegisterMod(p_modNewMod, strKey, false);
				m_setRemovedModKeys.Remove(strKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Gets the key that was assigned to the specified mod.
			/// </summary>
			/// <param name="p_modMod">The mod whose key is to be retrieved.</param>
			/// <returns>The key that was assigned to the specified mod, or <c>null</c> if
			/// the specified mod has no key.</returns>
			public string GetModKey(IMod p_modMod)
			{
				string strKey = m_amrModKeys.GetKey(p_modMod);
				if (strKey == null)
					strKey = EnlistedInstallLog.m_amrModKeys.GetKey(p_modMod);
				return strKey;
			}

			/// <summary>
			/// Gets the mod identified by the given key.
			/// </summary>
			/// <param name="p_strKey">The key of the mod to be retrieved.</param>
			/// <returns>The mod identified by the given key, or <c>null</c> if
			/// no mod is identified by the given key.</returns>
			public IMod GetMod(string p_strKey)
			{
				IMod modMod = m_amrModKeys.GetMod(p_strKey);
				if (modMod == null)
					modMod = EnlistedInstallLog.m_amrModKeys.GetMod(p_strKey);
				return modMod;
			}

			#endregion

			#region Uninstall

			/// <summary>
			/// Removes the mod, as well as entries for items installed by the given mod,
			/// from the install log.
			/// </summary>
			/// <param name="p_modUninstaller">The mod to remove.</param>
			public void RemoveMod(IMod p_modUninstaller)
			{
				string strUninstallerKey = GetModKey(p_modUninstaller);
				m_setRemovedModKeys.Add(strUninstallerKey);

				//remove the mod's files
				foreach (InstalledItemDictionary<string, object>.ItemInstallers insFile in m_dicInstalledFiles)
					insFile.Installers.Remove(strUninstallerKey);
				foreach (InstalledItemDictionary<string, object>.ItemInstallers insFile in EnlistedInstallLog.m_dicInstalledFiles)
					if (insFile.Installers.Contains(strUninstallerKey))
						m_dicUninstalledFiles[insFile.Item].Push(strUninstallerKey, null);

				//remove the mod's ini edits
				foreach (InstalledItemDictionary<IniEdit, string>.ItemInstallers insIniEdit in m_dicInstalledIniEdits)
					insIniEdit.Installers.Remove(strUninstallerKey);
				foreach (InstalledItemDictionary<IniEdit, string>.ItemInstallers insIniEdit in EnlistedInstallLog.m_dicInstalledIniEdits)
					if (insIniEdit.Installers.Contains(strUninstallerKey))
						m_dicUninstalledIniEdits[insIniEdit.Item].Push(strUninstallerKey, null);

				//remove the mod's game specific value edits
				foreach (InstalledItemDictionary<string, byte[]>.ItemInstallers insGameSpecificValueEdit in m_dicInstalledGameSpecificValueEdits)
					insGameSpecificValueEdit.Installers.Remove(strUninstallerKey);
				foreach (InstalledItemDictionary<string, byte[]>.ItemInstallers insGameSpecificValueEdit in EnlistedInstallLog.m_dicInstalledGameSpecificValueEdits)
					if (insGameSpecificValueEdit.Installers.Contains(strUninstallerKey))
						m_dicUninstalledGameSpecificValueEdits[insGameSpecificValueEdit.Item].Push(strUninstallerKey, null);

				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			#endregion

			#region File Version Management

			/// <summary>
			/// Gets the ordered list of mod that have installed the specified file.
			/// </summary>
			/// <param name="p_strPath">The path of the file for which to retrieve the list of installing mods.</param>
			/// <returns>The ordered list of mods that have installed the specified file.</returns>
			protected InstallerStack<object> GetCurrentFileInstallers(string p_strPath)
			{
				string strNormalizedPath = PathUtil.NormalizePath(p_strPath);
				InstallerStack<object> stkInstallers = new InstallerStack<object>();
				if (EnlistedInstallLog.m_dicInstalledFiles.ContainsItem(strNormalizedPath))
					stkInstallers.PushRange(EnlistedInstallLog.m_dicInstalledFiles[strNormalizedPath]);
				if (m_dicInstalledFiles.ContainsItem(strNormalizedPath))
					foreach (InstalledValue<object> isvMod in m_dicInstalledFiles[strNormalizedPath])
					{
						stkInstallers.Remove(isvMod);
						stkInstallers.Push(isvMod);
					}
				if (m_dicUninstalledFiles.ContainsItem(strNormalizedPath))
					foreach (InstalledValue<object> isvMod in m_dicUninstalledFiles[strNormalizedPath])
						stkInstallers.Remove(isvMod);
				m_setRemovedModKeys.ForEach(x => stkInstallers.Remove(x));
				return stkInstallers;
			}

			/// <summary>
			/// Logs the specified data file as having been installed by the given mod.
			/// </summary>
			/// <param name="p_modInstallingMod">The mod installing the specified data file.</param>
			/// <param name="p_strDataFilePath">The file bieng installed.</param>
			public void AddDataFile(IMod p_modInstallingMod, string p_strDataFilePath)
			{
				string strInstallingModKey = AddActiveMod(p_modInstallingMod, false);
				string strNormalizedPath = PathUtil.NormalizePath(p_strDataFilePath);
				m_dicInstalledFiles[strNormalizedPath].Push(strInstallingModKey, null);
				if (m_dicUninstalledFiles.ContainsItem(strNormalizedPath))
					m_dicUninstalledFiles[strNormalizedPath].Remove(strInstallingModKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Removes the specified data file as having been installed by the given mod.
			/// </summary>
			/// <param name="p_modUninstallingMod">The mod for which to remove the specified data file.</param>
			/// <param name="p_strDataFilePath">The file being removed for the given mod.</param>
			public void RemoveDataFile(IMod p_modUninstallingMod, string p_strDataFilePath)
			{
				string strUninstallingModKey = GetModKey(p_modUninstallingMod);
				if (String.IsNullOrEmpty(strUninstallingModKey))
					return;
				string strNormalizedPath = PathUtil.NormalizePath(p_strDataFilePath);
				m_dicUninstalledFiles[strNormalizedPath].Push(strUninstallingModKey, null);
				if (m_dicInstalledFiles.ContainsItem(strNormalizedPath))
					m_dicInstalledFiles[strNormalizedPath].Remove(strUninstallingModKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Gets the mod that owns the specified file.
			/// </summary>
			/// <param name="p_strPath">The path of the file whose owner is to be retrieved.</param>
			/// <returns>The mod that owns the specified file.</returns>
			public IMod GetCurrentFileOwner(string p_strPath)
			{
				InstallerStack<object> stkInstallers = GetCurrentFileInstallers(p_strPath);
				if (stkInstallers.Count == 0)
					return null;
				return GetMod(stkInstallers.Peek().InstallerKey);
			}

			/// <summary>
			/// Gets the mod that owned the specified file prior to the current owner.
			/// </summary>
			/// <param name="p_strPath">The path of the file whose previous owner is to be retrieved.</param>
			/// <returns>The mod that owned the specified file prior to the current owner.</returns>
			public IMod GetPreviousFileOwner(string p_strPath)
			{
				InstallerStack<object> stkInstallers = GetCurrentFileInstallers(p_strPath);
				if (stkInstallers.Count < 2)
					return null;
				stkInstallers.Pop();
				return GetMod(stkInstallers.Peek().InstallerKey);
			}

			/// <summary>
			/// Logs that the specified data file is an original value.
			/// </summary>
			/// <remarks>
			/// Logging an original data file prepares it to be overwritten by a mod's file.
			/// </remarks>
			/// <param name="p_strDataFilePath">The path of the data file to log as an
			/// original value.</param>
			public void LogOriginalDataFile(string p_strDataFilePath)
			{
				if (GetCurrentFileOwner(p_strDataFilePath) != null)
					return;
				AddDataFile(OriginalValueMod, p_strDataFilePath);
			}

			/// <summary>
			/// Gets the list of files that was installed by the given mod.
			/// </summary>
			/// <param name="p_modInstaller">The mod whose isntalled files are to be returned.</param>
			/// <returns>The list of files that was installed by the given mod.</returns>
			public IList<string> GetInstalledModFiles(IMod p_modInstaller)
			{
				Set<string> setFiles = new Set<string>(StringComparer.OrdinalIgnoreCase);
				string strInstallerKey = GetModKey(p_modInstaller);
				if (String.IsNullOrEmpty(strInstallerKey) || m_setRemovedModKeys.Contains(strInstallerKey))
					return setFiles;
				setFiles.AddRange(from itm in m_dicInstalledFiles
								  where itm.Installers.Contains(strInstallerKey)
								  select itm.Item);
				setFiles.AddRange(from itm in EnlistedInstallLog.m_dicInstalledFiles
								  where itm.Installers.Contains(strInstallerKey)
								  select itm.Item);
				setFiles.RemoveRange(from itm in m_dicUninstalledFiles
									 where itm.Installers.Contains(strInstallerKey)
									 select itm.Item);
				return setFiles;
			}

			/// <summary>
			/// Gets all of the mods that have installed the specified file.
			/// </summary>
			/// <remarks>
			/// The returned list is ordered by install date. In other words, the first
			/// mod in the list was the first to install the file, and the last mod in
			/// the list was the most recent. This implies that the current version of
			/// the specified file was installed by the last mod in the list. 
			/// </remarks>
			/// <param name="p_strPath">The path of the file whose installers are to be retrieved.</param>
			/// <returns>All of the mods that have installed the specified file.</returns>
			public IList<IMod> GetFileInstallers(string p_strPath)
			{
				InstallerStack<object> stkInstallers = GetCurrentFileInstallers(p_strPath);
				List<IMod> lstInstallers = new List<IMod>();
				foreach (InstalledValue<object> ivlInstaller in stkInstallers)
					lstInstallers.Add(GetMod(ivlInstaller.InstallerKey));
				return lstInstallers;
			}

			#endregion

			#region INI Version Management

			/// <summary>
			/// Gets the ordered list of mod that have installed the given ini edit.
			/// </summary>
			/// <param name="p_iedEdit">The ini edit for which to retrieve the list of installing mods.</param>
			/// <returns>The ordered list of mods that have installed the given ini edit.</returns>
			protected InstallerStack<string> GetCurrentIniEditInstallers(IniEdit p_iedEdit)
			{
				InstallerStack<string> stkInstallers = new InstallerStack<string>();
				if (EnlistedInstallLog.m_dicInstalledIniEdits.ContainsItem(p_iedEdit))
					stkInstallers.PushRange(EnlistedInstallLog.m_dicInstalledIniEdits[p_iedEdit]);
				if (m_dicInstalledIniEdits.ContainsItem(p_iedEdit))
					foreach (InstalledValue<string> isvMod in m_dicInstalledIniEdits[p_iedEdit])
					{
						stkInstallers.Remove(isvMod);
						stkInstallers.Push(isvMod);
					}
				if (m_dicReplacedIniEdits.ContainsItem(p_iedEdit))
					foreach (InstalledValue<string> isvMod in m_dicReplacedIniEdits[p_iedEdit])
						stkInstallers.Find(x => x.Equals(isvMod)).Value = isvMod.Value;
				if (m_dicUninstalledIniEdits.ContainsItem(p_iedEdit))
					foreach (InstalledValue<string> isvMod in m_dicUninstalledIniEdits[p_iedEdit])
						stkInstallers.Remove(isvMod);
				m_setRemovedModKeys.ForEach(x => stkInstallers.Remove(x));
				return stkInstallers;
			}

			/// <summary>
			/// Logs the specified INI edit as having been installed by the given mod.
			/// </summary>
			/// <param name="p_modInstallingMod">The mod installing the specified INI edit.</param>
			/// <param name="p_strSettingsFileName">The name of the edited INI file.</param>
			/// <param name="p_strSection">The section containing the INI edit.</param>
			/// <param name="p_strKey">The key of the edited INI value.</param>
			/// <param name="p_strValue">The value installed by the mod.</param>
			public void AddIniEdit(IMod p_modInstallingMod, string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue)
			{
				string strInstallingModKey = AddActiveMod(p_modInstallingMod, false);
				IniEdit iedEdit = new IniEdit(p_strSettingsFileName, p_strSection, p_strKey);
				m_dicInstalledIniEdits[iedEdit].Push(strInstallingModKey, p_strValue);
				if (m_dicUninstalledIniEdits.ContainsItem(iedEdit))
					m_dicUninstalledIniEdits[iedEdit].Remove(strInstallingModKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Replaces the edited value of the specified INI edit installed by the given mod.
			/// </summary>
			/// <param name="p_modInstallingMod">The mod whose INI edit value is to be replaced.</param>
			/// <param name="p_strSettingsFileName">The name of the Ini value whose edited value is to be replaced.</param>
			/// <param name="p_strSection">The section of the Ini value whose edited value is to be replaced.</param>
			/// <param name="p_strKey">The key of the Ini value whose edited value is to be replaced.</param>
			/// <param name="p_strValue">The value with which to replace the edited value of the specified INI edit installed by the given mod.</param>
			public void ReplaceIniEdit(IMod p_modInstallingMod, string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue)
			{
				string strInstallingModKey = GetModKey(p_modInstallingMod);
				IniEdit iedEdit = new IniEdit(p_strSettingsFileName, p_strSection, p_strKey);
				m_dicReplacedIniEdits[iedEdit].Push(strInstallingModKey, p_strValue);
				if (m_dicUninstalledIniEdits.ContainsItem(iedEdit))
					m_dicUninstalledIniEdits[iedEdit].Remove(strInstallingModKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Removes the specified ini edit as having been installed by the given mod.
			/// </summary>
			/// <param name="p_modUninstallingMod">The mod for which to remove the specified ini edit.</param>
			/// <param name="p_strSettingsFileName">The name of the edited INI file containing the INI edit being removed for the given mod.</param>
			/// <param name="p_strSection">The section containting the INI edit being removed for the given mod.</param>
			/// <param name="p_strKey">The key of the edited INI value whose edit is being removed for the given mod.</param>
			public void RemoveIniEdit(IMod p_modUninstallingMod, string p_strSettingsFileName, string p_strSection, string p_strKey)
			{
				string strUninstallingModKey = GetModKey(p_modUninstallingMod);
				if (String.IsNullOrEmpty(strUninstallingModKey))
					return;
				IniEdit iedEdit = new IniEdit(p_strSettingsFileName, p_strSection, p_strKey);
				m_dicUninstalledIniEdits[iedEdit].Push(strUninstallingModKey, null);
				if (m_dicInstalledIniEdits.ContainsItem(iedEdit))
					m_dicInstalledIniEdits[iedEdit].Remove(strUninstallingModKey);
				if (m_dicReplacedIniEdits.ContainsItem(iedEdit))
					m_dicReplacedIniEdits[iedEdit].Remove(strUninstallingModKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Gets the mod that owns the specified INI edit.
			/// </summary>
			/// <param name="p_strSettingsFileName">The name of the edited INI file.</param>
			/// <param name="p_strSection">The section containting the INI edit.</param>
			/// <param name="p_strKey">The key of the edited INI value.</param>
			/// <returns>The mod that owns the specified INI edit.</returns>
			public IMod GetCurrentIniEditOwner(string p_strSettingsFileName, string p_strSection, string p_strKey)
			{
				IniEdit iedEdit = new IniEdit(p_strSettingsFileName, p_strSection, p_strKey);
				InstallerStack<string> stkInstallers = GetCurrentIniEditInstallers(iedEdit);
				if (stkInstallers.Count == 0)
					return null;
				return GetMod(stkInstallers.Peek().InstallerKey);
			}

			/// <summary>
			/// Gets the value of the specified key before it was most recently overwritten.
			/// </summary>
			/// <param name="p_strSettingsFileName">The Ini file containing the key whose previous value is to be retrieved.</param>
			/// <param name="p_strSection">The section containing the key whose previous value is to be retrieved.</param>
			/// <param name="p_strKey">The key whose previous value is to be retrieved.</param>
			/// <returns>The value of the specified key before it was most recently overwritten, or
			/// <c>null</c> if there was no previous value.</returns>
			public string GetPreviousIniValue(string p_strSettingsFileName, string p_strSection, string p_strKey)
			{
				IniEdit iedEdit = new IniEdit(p_strSettingsFileName, p_strSection, p_strKey);
				InstallerStack<string> stkInstallers = GetCurrentIniEditInstallers(iedEdit);
				if (stkInstallers.Count < 2)
					return null;
				stkInstallers.Pop();
				return stkInstallers.Peek().Value;
			}

			/// <summary>
			/// Logs that the specified INI value is an original value.
			/// </summary>
			/// <remarks>
			/// Logging an original INI value prepares it to be overwritten by a mod's value.
			/// </remarks>
			/// <param name="p_strSettingsFileName">The name of the INI file containing the original value to log.</param>
			/// <param name="p_strSection">The section containting the original INI value to log.</param>
			/// <param name="p_strKey">The key of the original INI value to log.</param>
			/// <param name="p_strValue">The value installed by the mod.</param>
			public void LogOriginalIniValue(string p_strSettingsFileName, string p_strSection, string p_strKey, string p_strValue)
			{
				if (GetCurrentIniEditOwner(p_strSettingsFileName, p_strSection, p_strKey) != null)
					return;
				AddIniEdit(OriginalValueMod, p_strSettingsFileName, p_strSection, p_strKey, p_strValue);
			}

			/// <summary>
			/// Gets the list of INI edit that were installed by the given mod.
			/// </summary>
			/// <param name="p_modInstaller">The mod whose isntalled files are to be returned.</param>
			/// <returns>The list of files that was installed by the given mod.</returns>
			public IList<IniEdit> GetInstalledIniEdits(IMod p_modInstaller)
			{
				Set<IniEdit> setEdits = new Set<IniEdit>();
				string strInstallerKey = GetModKey(p_modInstaller);
				if (String.IsNullOrEmpty(strInstallerKey) || m_setRemovedModKeys.Contains(strInstallerKey))
					return setEdits;
				setEdits.AddRange(from itm in m_dicInstalledIniEdits
								  where itm.Installers.Contains(strInstallerKey)
								  select itm.Item);
				setEdits.AddRange(from itm in EnlistedInstallLog.m_dicInstalledIniEdits
								  where itm.Installers.Contains(strInstallerKey)
								  select itm.Item);
				setEdits.RemoveRange(from itm in m_dicUninstalledIniEdits
									 where itm.Installers.Contains(strInstallerKey)
									 select itm.Item);
				return setEdits;
			}

			/// <summary>
			/// Gets all of the mods that have installed the specified Ini edit.
			/// </summary>
			/// <param name="p_strSettingsFileName">The Ini file containing the key whose installers are to be retrieved.</param>
			/// <param name="p_strSection">The section containing the key whose installers are to be retrieved.</param>
			/// <param name="p_strKey">The key whose installers are to be retrieved.</param>
			/// <returns>All of the mods that have installed the specified Ini edit.</returns>
			public IList<IMod> GetIniEditInstallers(string p_strSettingsFileName, string p_strSection, string p_strKey)
			{
				IniEdit iedEdit = new IniEdit(p_strSettingsFileName, p_strSection, p_strKey);
				InstallerStack<string> stkInstallers = GetCurrentIniEditInstallers(iedEdit);
				List<IMod> lstInstallers = new List<IMod>();
				foreach (InstalledValue<string> ivlInstaller in stkInstallers)
					lstInstallers.Add(GetMod(ivlInstaller.InstallerKey));
				return lstInstallers;
			}

			#endregion

			#region Game Specific Value Version Management

			/// <summary>
			/// Gets the ordered list of mod that have installed the specified game specific value edit.
			/// </summary>
			/// <param name="p_strKey">The key of the game specific value edit for which to retrieve the list of installing mods.</param>
			/// <returns>The ordered list of mods that have installed the specified game specific value edit.</returns>
			protected InstallerStack<byte[]> GetCurrentGameSpecificValueInstallers(string p_strKey)
			{
				InstallerStack<byte[]> stkInstallers = new InstallerStack<byte[]>();
				if (EnlistedInstallLog.m_dicInstalledGameSpecificValueEdits.ContainsItem(p_strKey))
					stkInstallers.PushRange(EnlistedInstallLog.m_dicInstalledGameSpecificValueEdits[p_strKey]);
				if (m_dicInstalledGameSpecificValueEdits.ContainsItem(p_strKey))
					foreach (InstalledValue<byte[]> isvMod in m_dicInstalledGameSpecificValueEdits[p_strKey])
					{
						stkInstallers.Remove(isvMod);
						stkInstallers.Push(isvMod);
					}
				if (m_dicReplacedGameSpecificValueEdits.ContainsItem(p_strKey))
					foreach (InstalledValue<byte[]> isvMod in m_dicReplacedGameSpecificValueEdits[p_strKey])
						stkInstallers.Find(x => x.Equals(isvMod)).Value = isvMod.Value;
				if (m_dicUninstalledGameSpecificValueEdits.ContainsItem(p_strKey))
					foreach (InstalledValue<byte[]> isvMod in m_dicUninstalledGameSpecificValueEdits[p_strKey])
						stkInstallers.Remove(isvMod);
				m_setRemovedModKeys.ForEach(x => stkInstallers.Remove(x));
				return stkInstallers;
			}

			/// <summary>
			/// Logs the specified Game Specific Value edit as having been installed by the given mod.
			/// </summary>
			/// <param name="p_modInstallingMod">The mod installing the specified INI edit.</param>
			/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
			/// <param name="p_bteValue">The value installed by the mod.</param>
			public void AddGameSpecificValueEdit(IMod p_modInstallingMod, string p_strKey, byte[] p_bteValue)
			{
				string strInstallingModKey = AddActiveMod(p_modInstallingMod, false);
				m_dicInstalledGameSpecificValueEdits[p_strKey].Push(strInstallingModKey, p_bteValue);
				if (m_dicUninstalledGameSpecificValueEdits.ContainsItem(p_strKey))
					m_dicUninstalledGameSpecificValueEdits[p_strKey].Remove(strInstallingModKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Replaces the edited value of the specified game specific value edit installed by the given mod.
			/// </summary>
			/// <param name="p_modInstallingMod">The mod whose game specific value edit value is to be replaced.</param>
			/// <param name="p_strKey">The key of the game spcified value whose edited value is to be replaced.</param>
			/// <param name="p_bteValue">The value with which to replace the edited value of the specified game specific value edit installed by the given mod.</param>
			public void ReplaceGameSpecificValueEdit(IMod p_modInstallingMod, string p_strKey, byte[] p_bteValue)
			{
				string strInstallingModKey = GetModKey(p_modInstallingMod);
				m_dicReplacedGameSpecificValueEdits[p_strKey].Push(strInstallingModKey, p_bteValue);
				if (m_dicUninstalledGameSpecificValueEdits.ContainsItem(p_strKey))
					m_dicUninstalledGameSpecificValueEdits[p_strKey].Remove(strInstallingModKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Removes the specified Game Specific Value edit as having been installed by the given mod.
			/// </summary>
			/// <param name="p_modUninstallingMod">The mod for which to remove the specified Game Specific Value edit.</param>
			/// <param name="p_strKey">The key of the Game Specific Value whose edit is being removed for the given mod.</param>
			public void RemoveGameSpecificValueEdit(IMod p_modUninstallingMod, string p_strKey)
			{
				string strUninstallingModKey = GetModKey(p_modUninstallingMod);
				if (String.IsNullOrEmpty(strUninstallingModKey))
					return;
				m_dicUninstalledGameSpecificValueEdits[p_strKey].Push(strUninstallingModKey, null);
				if (m_dicInstalledGameSpecificValueEdits.ContainsItem(p_strKey))
					m_dicInstalledGameSpecificValueEdits[p_strKey].Remove(strUninstallingModKey);
				if (m_dicReplacedGameSpecificValueEdits.ContainsItem(p_strKey))
					m_dicReplacedGameSpecificValueEdits[p_strKey].Remove(strUninstallingModKey);
				if (CurrentTransaction == null)
					Commit();
				else
					Enlist();
			}

			/// <summary>
			/// Gets the mod that owns the specified Game Specific Value edit.
			/// </summary>
			/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
			/// <returns>The mod that owns the specified Game Specific Value edit.</returns>
			public IMod GetCurrentGameSpecificValueEditOwner(string p_strKey)
			{
				InstallerStack<byte[]> stkInstallers = GetCurrentGameSpecificValueInstallers(p_strKey);
				if (stkInstallers.Count == 0)
					return null;
				return GetMod(stkInstallers.Peek().InstallerKey);
			}

			/// <summary>
			/// Gets the value of the specified key before it was most recently overwritten.
			/// </summary>
			/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
			/// <returns>The value of the specified key before it was most recently overwritten, or
			/// <c>null</c> if there was no previous value.</returns>
			public byte[] GetPreviousGameSpecificValue(string p_strKey)
			{
				InstallerStack<byte[]> stkInstallers = GetCurrentGameSpecificValueInstallers(p_strKey);
				if (stkInstallers.Count < 2)
					return null;
				stkInstallers.Pop();
				return stkInstallers.Peek().Value;
			}

			/// <summary>
			/// Logs that the specified Game Specific Value is an original value.
			/// </summary>
			/// <remarks>
			/// Logging an original Game Specific Value prepares it to be overwritten by a mod's value.
			/// </remarks>
			/// <param name="p_strKey">The key of the edited Game Specific Value.</param>
			/// <param name="p_bteValue">The original value.</param>
			public void LogOriginalGameSpecificValue(string p_strKey, byte[] p_bteValue)
			{
				if (GetCurrentGameSpecificValueEditOwner(p_strKey) != null)
					return;
				AddGameSpecificValueEdit(OriginalValueMod, p_strKey, p_bteValue);
			}

			/// <summary>
			/// Gets the list of Game Specific Value edited keys that were installed by the given mod.
			/// </summary>
			/// <param name="p_modInstaller">The mod whose isntalled edits are to be returned.</param>
			/// <returns>The list of edited keys that was installed by the given mod.</returns>
			public IList<string> GetInstalledGameSpecificValueEdits(IMod p_modInstaller)
			{
				Set<string> setGameSpecificValues = new Set<string>();
				string strInstallerKey = GetModKey(p_modInstaller);
				if (String.IsNullOrEmpty(strInstallerKey) || m_setRemovedModKeys.Contains(strInstallerKey))
					return setGameSpecificValues;
				setGameSpecificValues.AddRange(from itm in m_dicInstalledGameSpecificValueEdits
												where itm.Installers.Contains(strInstallerKey)
												select itm.Item);
				setGameSpecificValues.AddRange(from itm in EnlistedInstallLog.m_dicInstalledGameSpecificValueEdits
												where itm.Installers.Contains(strInstallerKey)
												select itm.Item);
				setGameSpecificValues.RemoveRange(from itm in m_dicUninstalledGameSpecificValueEdits
												  where itm.Installers.Contains(strInstallerKey)
												  select itm.Item);
				return setGameSpecificValues;
			}

			/// <summary>
			/// Gets all of the mods that have installed the specified game specific value edit.
			/// </summary>
			/// <param name="p_strKey">The key whose installers are to be retrieved.</param>
			/// <returns>All of the mods that have installed the specified game specific value edit.</returns>
			public IList<IMod> GetGameSpecificValueEditInstallers(string p_strKey)
			{
				InstallerStack<byte[]> stkInstallers = GetCurrentGameSpecificValueInstallers(p_strKey);
				List<IMod> lstInstallers = new List<IMod>();
				foreach (InstalledValue<byte[]> ivlInstaller in stkInstallers)
					lstInstallers.Add(GetMod(ivlInstaller.InstallerKey));
				return lstInstallers;
			}

			#endregion

			#region IDisposable Support
			private bool m_DisposedValue = false;

			protected virtual void Dispose(bool disposing)
			{
				if (!m_DisposedValue)
				{
					if (disposing)
					{
						m_amrModKeys.Dispose();
					}

					m_DisposedValue = true;
				}
			}

			public void Dispose()
			{
				Dispose(true);
			}
			#endregion
		}

		#region IDisposable Support
		private bool m_DisposedValue = false;

		protected virtual void Dispose(bool disposing)
		{
			if (!m_DisposedValue)
			{
				if (disposing)
				{
					m_amrModKeys.Dispose();
				}

				m_DisposedValue = true;
			}
		}

		public void Dispose()
		{
			Dispose(true);
		}
		#endregion
	}
}
