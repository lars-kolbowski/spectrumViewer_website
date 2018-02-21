//		a spectrum viewer
//
//	  Copyright  2015 Rappsilber Laboratory, Edinburgh University
//
// 		Licensed under the Apache License, Version 2.0 (the "License");
// 		you may not use this file except in compliance with the License.
// 		You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
//   	Unless required by applicable law or agreed to in writing, software
//   	distributed under the License is distributed on an "AS IS" BASIS,
//   	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   	See the License for the specific language governing permissions and
//   	limitations under the License.
//
//		authors: Colin Combe, Lars Kolbowski
//
//		graph/Peak.js

function Peak (id, graph){
	var peak = graph.model.JSONdata.peaks[id];
	this.id = id;
	this.x = peak.mz;
	this.y = peak.intensity;
	this.IsotopeClusters = [];
	this.labels = [];
	for (i=0; i<peak.clusterIds.length; i++){
		cluster = graph.model.JSONdata.clusters[peak.clusterIds[i]]
		cluster.id = peak.clusterIds[i]
		this.IsotopeClusters.push(cluster);
	}
	this.clusterIds = peak.clusterIds
	this.graph = graph;

	//make fragments
	this.fragments = [];
	this.isotopes = [];
	this.isotopenumbers = [];
	//this.isMonoisotopic = false;	//monoisotopic peak for at least one fragment

	var fragments = graph.model.fragments;
	for (var f = 0; f < fragments.length; f++) {
		if(_.intersection(fragments[f].clusterIds, this.clusterIds).length != 0){
			//monoisotopic peak for this fragment
			intersect = _.intersection(fragments[f].clusterIds, this.clusterIds)
				for (var i = 0; i < intersect.length; i++) {
					fragments[f].isMonoisotopic = false;
					for (var j = 0; j < this.IsotopeClusters.length; j++) {
						var isotope = id - this.IsotopeClusters[j].firstPeakId;
						if (this.IsotopeClusters[j].id == intersect[i] && this.IsotopeClusters[j].firstPeakId == id){
							fragments[f].isMonoisotopic = true;
							//this.isMonoisotopic = true
						}
					}

				}
			if(fragments[f].isMonoisotopic)
				this.fragments.push(fragments[f]);
			else{
				this.isotopes.push(fragments[f]);
				this.isotopenumbers.push(isotope);
			}
		}
	};

	//svg elements
	this.linegroup = this.graph.peaksSVG.append('g');

	if (this.fragments.length > 0) {
		this.highlightLine = this.graph.highlights.append('line')
								.attr("stroke", this.graph.model.highlightColour)
								.attr("stroke-width", this.graph.model.highlightWidth)
								.attr("opacity","0")
								.attr("x1", 0)
								.attr("x2", 0)
							;

		//set the dom events for it
		var self = this;

		this.linegroup
			.on("mouseover", function() {
				var evt = d3.event;
				if (evt.ctrlKey){
					self.line.style("cursor", "copy");
					self.highlightLine.style("cursor", "copy");
				}
				else{
					self.line.style("cursor", "pointer");
					self.highlightLine.style("cursor", "pointer");
				}
				showTooltip(evt.pageX, evt.pageY);
				startHighlight();
			})
			.on("mouseout", function() {

				hideTooltip();
				endHighlight();
			})
			.on("touchstart", function() {
				var evt = d3.event;
				showTooltip(evt.layerX, evt.layerY);
				startHighlight();
			})
			.on("touchend", function() {
				hideTooltip();
				endHighlight();
			})
			.on("click", function() {
				var evt = d3.event;
				stickyHighlight(evt.ctrlKey);
			})
			;

		function showTooltip(x, y, fragId){
			var contents = [["m/z", self.x.toFixed(self.graph.model.showDecimals)], ["Int", self.y.toFixed(self.graph.model.showDecimals)]];
			var header = [];

			//filter fragments shown in tooltip (only fraglabel is hovered over)
			if(fragId){
				fragId = parseInt(fragId);
				var fragments = self.fragments.filter(function(d) { return d.id == fragId; });
			}
			else
				var fragments = self.fragments;

			var fragCount = fragments.length;
			for (var f = 0; f < fragCount; f++){
					//get right cluster for peak
					index = 0;
					for (var i = 0; i < self.clusterIds.length; i++) {
						if(fragments[f].clusterIds.indexOf(self.clusterIds[i]) != -1){
							index = fragments[f].clusterIds.indexOf(self.clusterIds[i])
							cluster = graph.model.JSONdata.clusters[self.clusterIds[i]]
						}
					}

					charge = cluster.charge;
					error = fragments[f].clusterInfo[index].error.toFixed(2)+" "+fragments[f].clusterInfo[index].errorUnit;
					header.push(fragments[f].name);
					contents.push([fragments[f].name + " (" + fragments[f].sequence + ")", "charge: " + charge + ", error: " + error]);
			};


		//Tooltip
		if (CLMSUI.compositeModelInst !== undefined){
			self.graph.tooltip.set("contents", contents )
				.set("header", header.join(" "))
				.set("location", {pageX: x, pageY: y});
				//.set("location", {pageX: d3.event.pageX, pageY: d3.event.pageY})
		}
		else{
			var html = header.join(" ");
			for (var i = contents.length - 1; i >= 0; i--) {
				html += "</br>";
				html += contents[i].join(": ");
			}
			self.graph.tooltip.html(html);
			self.graph.tooltip.transition()
				.duration(200)
				.style("opacity", .9);

			//if cursor is too close to left window edge change tooltip to other side
			if (window.innerWidth - x < 250){
				var x = x - 250;
				var y = y + 20;
			}

			self.graph.tooltip.style("left", (x + 15) + "px")
				.style("top", y + "px");
		}


		};

		function hideTooltip(){
			if (CLMSUI.compositeModelInst !== undefined)
				self.graph.tooltip.set("contents", null);
			else{
				self.graph.tooltip.style("opacity", 0);
				self.graph.tooltip.html("");
			}
		};

		function startHighlight(fragId){
			var fragments = [];
			if(fragId){
				fragId = parseInt(fragId);
				fragments = self.fragments.filter(function(d) { return d.id == fragId; });
			}
			else{
				fragments = self.fragments;
			}
			self.graph.model.addHighlight(fragments);
		};

		function endHighlight(){
			//hideTooltip();
			self.graph.model.clearHighlight(self.fragments);
		};

		function stickyHighlight(ctrl, fragId){
			var fragments = [];
			if(fragId){
				fragId = parseInt(fragId);
				fragments = self.fragments.filter(function(d) { return d.id == fragId; });
			}
			else
				fragments = self.fragments;
			self.graph.model.updateStickyHighlight(fragments, ctrl);
		};


	  	//create frag labels
	  	//labeldrag
		this.labelDrag = d3.behavior.drag();
		this.labelDrag
			.on("dragstart", function(){
				self.labelLines.attr("opacity", 1); // MJG
			})
			.on("drag", function(d) {
				var coords = d3.mouse(this);
				var fragId = d.id;
				var filteredLabels = self.labels.filter(function(d) { return d.id == fragId; });
				var filteredHighlights = self.labelHighlights.filter(function(d) { return d.id == fragId; });
				var filteredLabelLines = self.labelLines.filter(function(d) { return d.id == fragId; });

				filteredLabels.attr("x", coords[0]).attr("y", coords[1]);
				filteredHighlights.attr("x", coords[0]).attr("y", coords[1]);

				var startX = self.graph.x(self.x);
				var startY = self.graph.y(self.y)
				var mouseX = coords[0];//-startX;
				var mouseY = coords[1];
				var r = Math.sqrt((mouseX * mouseX) + ((mouseY-startY) * (mouseY-startY) ));
				if (r > 15){
						filteredLabelLines
							.attr("opacity", 1)
							.attr("x1", 0)
							.attr("x2", mouseX)
							.attr("y1", startY)
							.attr("y2", mouseY)
						;
				}
				else
					filteredLabelLines.attr("opacity", 0);
			})
		;

		var lossy = [];
		var nonlossy = this.fragments.filter(function(frag) {
			var bool = frag.class != "lossy";
			if (!bool) { lossy.push (frag); }
			return bool;
		});

		var partitions = [
			{frags: nonlossy, group: this.graph.annotations, type: "nonlossy", colourClass: "color"},
			{frags: lossy, group: this.graph.lossyAnnotations, type: "lossy", colourClass: "color_loss"},
		];

		CLMSUI.idList = CLMSUI.idList || [];	//obsolete?

		var makeIdentityID = function (d) {
			return d.id;
		};

		partitions.forEach (function (partition) {
			var peakFrags = partition.frags;

			if (peakFrags.length > 0) {
				var group = partition.group;
				var labelgroup = self.linegroup.selectAll("g.label").data (peakFrags, makeIdentityID);
				var labelLines = self.linegroup.selectAll("line.labelLine").data (peakFrags, makeIdentityID);

				labelLines.enter()
					.append("line")
					.attr("stroke-width", 1)
					.attr("stroke", "Black")
					.attr("class", "labelLine")
					.style("stroke-dasharray", ("3, 3"));

				var label = labelgroup.enter()
					.append("g")
						.attr("class", "label")
						.style("cursor", "pointer")
						.on("mouseover", function(d) {
							var evt = d3.event;
							if(!self.graph.model.moveLabels){
								if (evt.ctrlKey){
									self.line.style("cursor", "copy");
									self.highlightLine.style("cursor", "copy");
								}
								else{
									self.line.style("cursor", "pointer");
									self.highlightLine.style("cursor", "pointer");
								}
								showTooltip(evt.pageX, evt.pageY, d.id);
								startHighlight(d.id);
							}
						})
						.on("mouseout", function() {
							if(!self.graph.model.moveLabels){
								hideTooltip();
								endHighlight();
							}
						})
						.on("touchstart", function(d) {
							var evt = d3.event;
							if(!self.graph.model.moveLabels){
								if (evt.ctrlKey){
									self.line.style("cursor", "copy");
									self.highlightLine.style("cursor", "copy");
								}
								else{
									self.line.style("cursor", "pointer");
									self.highlightLine.style("cursor", "pointer");
								}
								showTooltip(evt.pageX, evt.pageY, d.id);
								startHighlight(d.id);
							}
						})
						.on("touchend", function() {
							if(!self.graph.model.moveLabels){
								hideTooltip();
								endHighlight();
							}
						})
						.on("click", function(d) {
							var evt = d3.event;
							stickyHighlight(evt.ctrlKey, d.id);
						})
					;

				label.append("text")
					.text(function(d) {return d.name;})
					.attr("x", 0)
					.attr("text-anchor", "middle")
					.style("stroke-width", "6px")
					.style("font-size", "0.8em")
					.attr("class", "peakAnnotHighlight")
					.attr("stroke", this.graph.model.highlightColour);

				label.append("text")
					.text(function(d) {return d.name;})
					.attr("x", 0)
					.attr("text-anchor", "middle")
					.style("font-size", "0.8em")
					.attr("class", "peakAnnot")
					.attr ("fill", function(d) {
						var pepIndex = d.peptideId+1;
						return self.graph.model["p" + pepIndex + partition.colourClass];
					})
			}

		}, this);

		var fset = d3.set (this.fragments.map (function (frag) { return frag.id; }));
		this.labelgroups = self.linegroup.selectAll("g.label").filter (function(d) { return fset.has(d.id); });
		this.labels = this.labelgroups.selectAll("text.peakAnnot");
		this.labelHighlights = this.labelgroups.selectAll("text.peakAnnotHighlight");
		this.labelLines = self.linegroup.selectAll("line.labelLine").filter (function(d) { return fset.has(d.id); });
		this.highlight(false);

	}

	this.line = this.linegroup.append('line')
					.attr("stroke-width","1")
					.attr("x1", 0)
					.attr("x2", 0);

	if(this.fragments.length > 0){
		this.line.style("cursor", "pointer");
		this.highlightLine.style("cursor", "pointer");
	}


	this.colour = this.graph.model.peakColour;
	if (this.fragments.length > 0){

		var lossy = true;
		var index = 0;
		for (var i = 0; i < this.fragments.length; i++) {
			if (this.fragments[i].class == "non-lossy"){
				lossy = false;
				index = i;
			}
		}
		if (this.fragments[index].peptideId == 0) {
			if (!lossy)
				this.colour = this.graph.model.p1color;
			else
				this.colour = this.graph.model.p1color_loss;
		}
		else if (this.fragments[index].peptideId == 1) {
			if (!lossy)
				this.colour = this.graph.model.p2color;
			else
				this.colour = this.graph.model.p2color_loss;
		}
	}
	else if (this.isotopes.length > 0) {
		if(this.isotopes[0].peptideId == 0)
			this.colour = this.graph.model.p1color_cluster;
		if(this.isotopes[0].peptideId == 1)
			this.colour = this.graph.model.p2color_cluster;
	}
	this.line.attr("stroke", this.colour);
}

Peak.prototype.highlight = function(show, fragments){
	if (show == true) {
		this.highlightLine.attr("opacity","1");
		if (this.labels.length) {
			var fragMap = d3.set (fragments.map (function (frag) { return frag.id; }));
			var ffunc = function (d) { return fragMap.has (d.id); };
			this.labelHighlights.filter(ffunc)
				.attr("opacity", 1)
				.attr("display", "inline");
			;
			this.labels.filter(ffunc).attr("display", "inline");
		}
		this.graph.peaksSVG.node().appendChild(this.linegroup.node());
		this.line.attr("stroke", this.colour);
	} else {
		this.highlightLine.attr("opacity",0);
		if (this.labels.length){
			this.labelHighlights.attr("opacity", 0);
		}
	}
}

Peak.prototype.update = function(){

	this.linegroup.attr("transform", "translate("+this.graph.x(this.x)+",0)");
	if(this.fragments.length > 0)
		this.highlightLine.attr("transform", "translate("+this.graph.x(this.x)+",0)");
	var xDomain = this.graph.x.domain();
	if (this.x > xDomain[0] && this.x < xDomain[1]){
		//reset label lines
		if (this.labels.length > 0){
				this.labelLines
					.attr("opacity", 0)
					.attr("x1", 0)
					.attr("x2", 0)
					.attr("y1", 0)
					.attr("y2", 0)
			}
		//update Peak position
		this.updateX(xDomain);
		this.updateY();
		//show peaks
		this.linegroup.attr("display","inline");
	} else {
		this.linegroup.attr("display","none");
	}
}

Peak.prototype.updateX = function(xDomain){
	var labelCount = this.labels.length;

	function stickyTest (d, peakObj) {
		return (peakObj.x > xDomain[0] && peakObj.x < xDomain[1])	//in current range
			 && (peakObj.graph.lossyShown === true || d.class == "non-lossy" || _.intersection(peakObj.graph.model.sticky, peakObj.fragments).length != 0)	//lossy enabled OR not lossy OR isStickyFrag
			 && (_.intersection(peakObj.graph.model.sticky, peakObj.fragments).length != 0 || peakObj.graph.model.sticky.length == 0)	//isStickyFrag OR no StickyFrags
	};
	var self = this;
	if (labelCount) {
		this.labels
			.attr("x", 0)
			.attr("display",function(d, i) {
				return stickyTest (d, self) ? "inline" : "none";
			})
		;
		this.labelHighlights
			.attr("x", 0)
			.attr("display",function(d) {
				return stickyTest (d, self) ? "inline" : "none";
			})
		;

	}
};

Peak.prototype.updateY = function(){
	var yScale = this.graph.y;
	this.line
		.attr("y1", yScale(this.y))
		.attr("y2", yScale(0));

	var labelCount = this.labels.length;

	if (labelCount > 0) {
		this.highlightLine
			.attr("y1", yScale(this.y))
			.attr("y2", yScale(0));
		var yStep = 15;
		var self = this;

		for (var i = 0; i < labelCount; i++) {
			this.labels[i][0].setAttribute("y",  yScale(self.y) - 5 - (yStep * i));
			this.labelHighlights[i][0].setAttribute("y",  yScale(self.y) - 5 - (yStep * i));
		}

		//this.labels.attr("y", function(d,i) { return yScale(self.y) - 5 - (yStep * i); });
		//this.labelHighlights.attr("y", function(d,i) { return yScale(self.y) - 5 - (yStep * i); });
	}
}

Peak.prototype.removeLabels = function(){
	var labelCount = this.labels.length;
	if(labelCount){
		this.labels.attr("display", "none");
		this.labelHighlights.attr("display", "none");
		this.labelLines.attr("opacity", 0);
	}
}

Peak.prototype.showLabels = function(lossyOverride){
	var xDomain = this.graph.x.domain();
	var labelCount = this.labels.length;
	var self = this;
	if (labelCount) {
		var ffunc = function(d) {
			return (self.x > xDomain[0] && self.x < xDomain[1])
				&& (self.graph.lossyShown === true || d.class == "non-lossy" || lossyOverride == true);
		};
		this.labels.filter(ffunc).attr("display", "inline");
		this.labelHighlights.filter(ffunc).attr("display", "inline");
		this.labelLines.filter(ffunc).attr("opacity", 1);
	}
}

Peak.prototype.updateColor = function(){
	this.colour = this.graph.model.peakColour;
	if (this.fragments.length > 0){
		if (this.fragments[0].peptideId == 0) {
			if (this.fragments[0].class == "non-lossy")
				this.colour = this.graph.model.p1color;

			else if (this.fragments[0].class == "lossy")
				this.colour = this.graph.model.p1color_loss;
		}
		else if (this.fragments[0].peptideId == 1) {
			if (this.fragments[0].class == "non-lossy")
				this.colour = this.graph.model.p2color;
			else if (this.fragments[0].class == "lossy")
				this.colour = this.graph.model.p2color_loss;
		}
	}
	else if(this.isotopes.length > 0) {
		if(this.isotopes[0].peptideId == 0)
			this.colour = this.graph.model.p1color_cluster;
		if(this.isotopes[0].peptideId == 1)
			this.colour = this.graph.model.p2color_cluster;
	}
	this.line.attr("stroke", this.colour);
	if(this.labels.length)
		this.labels.attr("fill", this.colour);
}
