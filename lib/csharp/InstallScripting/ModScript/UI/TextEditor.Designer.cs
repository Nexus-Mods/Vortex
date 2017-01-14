namespace Nexus.Client.ModManagement.Scripting.ModScript.UI
{
	partial class TextEditor
	{
		/// <summary>
		/// Required designer variable.
		/// </summary>
		private System.ComponentModel.IContainer components = null;

		/// <summary>
		/// Clean up any resources being used.
		/// </summary>
		/// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
		protected override void Dispose(bool disposing)
		{
			if (disposing && (components != null))
			{
				components.Dispose();
			}
			base.Dispose(disposing);
		}

		#region Windows Form Designer generated code

		/// <summary>
		/// Required method for Designer support - do not modify
		/// the contents of this method with the code editor.
		/// </summary>
		private void InitializeComponent()
		{
			System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(TextEditor));
			this.toolStrip1 = new System.Windows.Forms.ToolStrip();
			this.tsbOpen = new System.Windows.Forms.ToolStripButton();
			this.tsbSave = new System.Windows.Forms.ToolStripButton();
			this.tbxText = new System.Windows.Forms.TextBox();
			this.ofdOpenFile = new System.Windows.Forms.OpenFileDialog();
			this.sfdSaveFile = new System.Windows.Forms.SaveFileDialog();
			this.panel1 = new System.Windows.Forms.Panel();
			this.butOK = new System.Windows.Forms.Button();
			this.butCancel = new System.Windows.Forms.Button();
			this.toolStrip1.SuspendLayout();
			this.panel1.SuspendLayout();
			this.SuspendLayout();
			// 
			// toolStrip1
			// 
			this.toolStrip1.GripStyle = System.Windows.Forms.ToolStripGripStyle.Hidden;
			this.toolStrip1.ImageScalingSize = new System.Drawing.Size(32, 32);
			this.toolStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.tsbOpen,
            this.tsbSave});
			this.toolStrip1.Location = new System.Drawing.Point(0, 0);
			this.toolStrip1.Name = "toolStrip1";
			this.toolStrip1.Size = new System.Drawing.Size(284, 39);
			this.toolStrip1.TabIndex = 0;
			this.toolStrip1.Text = "toolStrip1";
			// 
			// tsbOpen
			// 
			this.tsbOpen.DisplayStyle = System.Windows.Forms.ToolStripItemDisplayStyle.Image;
			this.tsbOpen.Image = ((System.Drawing.Image)(resources.GetObject("tsbOpen.Image")));
			this.tsbOpen.ImageTransparentColor = System.Drawing.Color.Magenta;
			this.tsbOpen.Name = "tsbOpen";
			this.tsbOpen.Size = new System.Drawing.Size(36, 36);
			this.tsbOpen.Text = "toolStripButton1";
			this.tsbOpen.Click += new System.EventHandler(this.tsbOpen_Click);
			// 
			// tsbSave
			// 
			this.tsbSave.DisplayStyle = System.Windows.Forms.ToolStripItemDisplayStyle.Image;
			this.tsbSave.Image = ((System.Drawing.Image)(resources.GetObject("tsbSave.Image")));
			this.tsbSave.ImageTransparentColor = System.Drawing.Color.Magenta;
			this.tsbSave.Name = "tsbSave";
			this.tsbSave.Size = new System.Drawing.Size(36, 36);
			this.tsbSave.Text = "toolStripButton2";
			this.tsbSave.Click += new System.EventHandler(this.tsbSave_Click);
			// 
			// tbxText
			// 
			this.tbxText.AcceptsReturn = true;
			this.tbxText.AcceptsTab = true;
			this.tbxText.Dock = System.Windows.Forms.DockStyle.Fill;
			this.tbxText.Location = new System.Drawing.Point(0, 39);
			this.tbxText.Multiline = true;
			this.tbxText.Name = "tbxText";
			this.tbxText.ScrollBars = System.Windows.Forms.ScrollBars.Vertical;
			this.tbxText.Size = new System.Drawing.Size(284, 176);
			this.tbxText.TabIndex = 1;
			// 
			// ofdOpenFile
			// 
			this.ofdOpenFile.Filter = "Text files|*.txt,*.rtf|All files|*.*";
			// 
			// sfdSaveFile
			// 
			this.sfdSaveFile.Filter = "Plain Text file|*.txt|Rich Text file|*.rtf";
			// 
			// panel1
			// 
			this.panel1.Controls.Add(this.butCancel);
			this.panel1.Controls.Add(this.butOK);
			this.panel1.Dock = System.Windows.Forms.DockStyle.Bottom;
			this.panel1.Location = new System.Drawing.Point(0, 215);
			this.panel1.Name = "panel1";
			this.panel1.Size = new System.Drawing.Size(284, 47);
			this.panel1.TabIndex = 2;
			// 
			// butOK
			// 
			this.butOK.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
			this.butOK.DialogResult = System.Windows.Forms.DialogResult.OK;
			this.butOK.Location = new System.Drawing.Point(116, 12);
			this.butOK.Name = "butOK";
			this.butOK.Size = new System.Drawing.Size(75, 23);
			this.butOK.TabIndex = 0;
			this.butOK.Text = "OK";
			this.butOK.UseVisualStyleBackColor = true;
			// 
			// butCancel
			// 
			this.butCancel.Anchor = ((System.Windows.Forms.AnchorStyles)((System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right)));
			this.butCancel.DialogResult = System.Windows.Forms.DialogResult.Cancel;
			this.butCancel.Location = new System.Drawing.Point(197, 12);
			this.butCancel.Name = "butCancel";
			this.butCancel.Size = new System.Drawing.Size(75, 23);
			this.butCancel.TabIndex = 1;
			this.butCancel.Text = "Cancel";
			this.butCancel.UseVisualStyleBackColor = true;
			// 
			// TextEditor
			// 
			this.AcceptButton = this.butOK;
			this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
			this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
			this.CancelButton = this.butCancel;
			this.ClientSize = new System.Drawing.Size(284, 262);
			this.Controls.Add(this.tbxText);
			this.Controls.Add(this.panel1);
			this.Controls.Add(this.toolStrip1);
			this.Name = "TextEditor";
			this.ShowInTaskbar = false;
			this.Text = "Text Editor";
			this.toolStrip1.ResumeLayout(false);
			this.toolStrip1.PerformLayout();
			this.panel1.ResumeLayout(false);
			this.ResumeLayout(false);
			this.PerformLayout();

		}

		#endregion

		private System.Windows.Forms.ToolStrip toolStrip1;
		private System.Windows.Forms.ToolStripButton tsbOpen;
		private System.Windows.Forms.ToolStripButton tsbSave;
		private System.Windows.Forms.TextBox tbxText;
		private System.Windows.Forms.OpenFileDialog ofdOpenFile;
		private System.Windows.Forms.SaveFileDialog sfdSaveFile;
		private System.Windows.Forms.Panel panel1;
		private System.Windows.Forms.Button butCancel;
		private System.Windows.Forms.Button butOK;
	}
}