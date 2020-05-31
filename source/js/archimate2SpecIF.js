/* 	Transform TOGAF Open Exchange to SpecIF
	Author: se@enso-managers.de
	License: Apache 2.0
*/

// Durchlaufen der XML Datei und Überführen der Elemente in das SpecIF Format
function TOGAF2Specif( xmlString, opts ) {
	"use strict";
	if( typeof(opts)!='object' || !opts.fileName ) return null;
	if( !opts.fileDate ) 
		opts.fileDate = new Date().toISOString();
	if( !opts.title ) 
		opts.title = opts.fileName.split(".")[0];
	if( typeof(opts.titleLength)!='number' )
		opts.titleLength = 96;
	if( typeof(opts.descriptionLength)!='number' )
		opts.descriptionLength = 8192;
	if( !opts.mimeType ) 
		opts.mimeType = "application/bpmn+xml";
	if( typeof(opts.isIE)!='boolean' )
		opts.isIE = /MSIE |rv:11.0/i.test( navigator.userAgent );

	if( !opts.strNamespace ) 
		opts.strNamespace = "archimate:";
	if( !opts.strFolderType ) 
		opts.strFolderType = "SpecIF:Heading";
	if( !opts.strDiagramsType ) 
		opts.strDiagramsType = "SpecIF:Diagrams";
	if( !opts.strGlossaryType ) 
		opts.strGlossaryType = "SpecIF:Glossary";
	if( !opts.strDiagramsFolder ) 
		opts.strDiagramsFolder = "Model-Diagrams";
	if( !opts.strGlossaryFolder ) 
		opts.strGlossaryFolder = "Model-Elements (Glossary)";
	if( !opts.strActorFolder ) 
		opts.strActorFolder = "Actors";
	if( !opts.strStateFolder ) 
		opts.strStateFolder = "States";
	if( !opts.strEventFolder ) 
		opts.strEventFolder = "Events";
	if( !opts.strCollectionFolder ) 
		opts.strCollectionFolder = "Collections and Groups";
/*	if( !opts.strAnnotationFolder ) 
		opts.strAnnotationFolder = "Text Annotations";
	if( !opts.strRoleType ) 
		opts.strRoleType = "SpecIF:Role";  */
	if( !opts.strTogafType ) 
		opts.strTogafType = 'SpecIF:TOGAF';
	if( !opts.strTogafFolder ) 
		opts.strTogafFolder = "TOGAF Enterprise Architecture Models";
	
	let parser = new DOMParser(),
		xmlDoc = parser.parseFromString(xmlString, "text/xml");
//	console.debug('xml',xmlDoc);
		
	// ToDo: Choose carefully between using tagName or nodeName,
	// see: https://stackoverflow.com/questions/4878484/difference-between-tagname-and-nodename
	
	// Get the model metadata:
	let L = Array.from(xmlDoc.querySelectorAll("model"));
/*	// There should be exactly one model per Open Exchange file:
	if( L.length<1 ) {
		console.error("... with id '",model.id,"' has no model.");
		return
	};
	if( L.length>1 )
		console.warn("Diagram with id '",model.id,"' has more than one model.");  */
	
	var model = {};
	// The project's id and title:
	model.id = L[0].getAttribute("identifier");

	const nbsp = '&#160;', // non-breakable space
		apx = simpleHash(model.id),
		hId = 'TOGAF-' + apx;

	model["$schema"] = "https://specif.de/v1.0/schema.json";
	model.dataTypes = DataTypes();
	model.propertyClasses = PropertyClasses();
	model.resourceClasses = ResourceClasses();
	model.statementClasses = StatementClasses();
	model.resources = Folders();
	model.statements = [];

	// 1. Additional attributes such as title and description:
	Array.from( L[0].children, 
		(ch)=>{
			switch( ch.tagName ) {
				case 'name': 
					model.title = ch.innerHTML;
					break;
				case 'documentation':
					model.description = ch.innerHTML;
			}
		}
	);

	// 2. Transform the diagrams:
	Array.from(xmlDoc.querySelectorAll("view"), 
		(vi)=>{
			let dId = vi.getAttribute('identifier'),
				r = {
					id: dId,
				//	title: '',
					class: "RC-Diagram",
					properties: [],
					changedAt: opts.fileDate
				};
				
				// The view's nodes are hierarchically ordered: 
				function getNode(nd) {
					let ref = nd.getAttribute('elementRef');
					if( ref )
						model.statements.push({
							id: genID('S-'),
							class: "SC-shows",
							subject: dId,
							object: ref,
							changedAt: opts.fileDate
						});
					Array.from( nd.children, 
						(ch)=>{
							if( ch.tagName=='node' )
								getNode(ch)
						}
					)
				}
			
			// Additional attributes such as title and description:
			Array.from( vi.children, 
				(ch)=>{
					switch( ch.tagName ) {
						case 'name': 
							r.title = ch.innerHTML;
							break;
						case 'documentation':
							r.properties.push({
								class: "PC-Text",
								value: ch.innerHTML
							});
							break;
						case 'node':
							// ToDo: Include nodes of xsi:type "Label" = Note elements
							// This node is shown by the diagram in the outer loop;
							// it is of xsi:type "Element":
							getNode(ch);
					/*		break;
						case 'connection':
							// This connection is shown by the diagram in the outer loop:
							model.statements.push({
								id: genID('S-'),
								class: "SC-shows",
								subject: dId,
								object: ch.getAttribute('relationshipRef'),
								changedAt: opts.fileDate  
							})  */
					}
				}
			);
			
			// ToDo: Add diagram reference (but we need the diagram, first).
			
			// Store the TOGAF viewpoint:
			let vp = vi.getAttribute('viewpoint');
			if( vp )
				r.properties.push({
					class: "PC-Type", 
					value: vp+' Viewpoint'
				});
			
			model.resources.push(r)
		}
	);

	// 3. Transform the model elements:
	L = Array.from(xmlDoc.querySelectorAll("element"), 
		(el)=>{
			let r = {
					id: el.getAttribute('identifier'),
				//	title: '',
					properties: [],
					changedAt: opts.fileDate
				},
				ty = el.getAttribute('xsi:type');

			// Determine the resourceClass:
			switch( ty ) {
				case 'BusinessActor':
				case 'BusinessRole':
				case 'BusinessCollaboration':
				case 'BusinessInterface':
				case 'BusinessProcess':
				case 'BusinessFunction':
				case 'BusinessInteraction':
				case 'BusinessService':
				case 'ApplicationComponent':
				case 'ApplicationCollaboration':
				case 'ApplicationInterface':
				case 'ApplicationFunction':
				case 'ApplicationInteraction':
				case 'ApplicationProcess':
				case 'ApplicationService':
				case 'Node':
				case 'Device':
				case 'SystemSoftware':
				case 'TechnologyCollaboration':
				case 'TechnologyInterface':
				case 'Path':
				case 'CommunicationNetwork':
				case 'TechnologyFunction':
				case 'TechnologyProcess':
				case 'TechnologyInteraction':
				case 'TechnologyService':
					r['class'] = "RC-Actor"
					break;
				case 'BusinessObject':
				case 'Contract':
				case 'Representation':
				case 'Product':
				case 'DataObject':
				case 'Artifact':
					r['class'] = "RC-State";
					break;
				case 'BusinessEvent':
				case 'ApplicationEvent':
				case 'TechnologyEvent':
					r['class'] = "RC-Event";
					break;
				case 'Location':
				case 'Grouping':
					r['class'] = "RC-Collection";
					break;
				default: 
					// The TOGAF element with tag  extensionElements  and title  <empty string>  has not been transformed.
					console.warn('Element: Unknown xsi:type ', ty);
					r['class'] = "RC-Folder";  // better than nothing!
			};

			if( r['class'] ) {
				// Additional attributes such as title and description:
				Array.from( el.children, 
					(ch)=>{
						switch( ch.tagName ) {
							case 'name': 
								r.title = ch.innerHTML;
								break;
							case 'documentation':
								r.properties.push({
									class: "PC-Text",
									value: ch.innerHTML
								})
						}
					}
				);

				// Store the TOGAF element-type:
				r.properties.push({
					class: "PC-Type", 
					value: opts.strNamespace+ty
				});

				model.resources.push(r)
			}
		}
	);
	
	// 4. Transform the relations:
	L = Array.from(xmlDoc.querySelectorAll("relationship"), 
		(rs)=>{
			let s = {
					id: rs.getAttribute('identifier'),
					subject: rs.getAttribute('source'),
					object: rs.getAttribute('target'),
					changedAt: opts.fileDate
				},
				ty = rs.getAttribute('xsi:type');

			// Determine the statementClass:
			switch( ty ) {
				case 'Access':
					switch( rs.getAttribute('accessType') ) {
						case 'Write':
							s['class'] = "SC-writes";
							break
						case 'Read':
							s['class'] = "SC-reads"
					};
					break;
				case 'Serving':
					s['class'] = "SC-serves";
					break;
				case 'Triggering':
					s['class'] = "SC-triggers";
					break;
				case 'Flow':
					s['class'] = "SC-precedes";
					break;
				case 'Composition':
			//		s['class'] = "SC-isComposedOf";
					s['class'] = "SC-contains";
					break;
				case 'Aggregation':
					s['class'] = "SC-isAggregatedBy";
					break;
				case 'Realization':
					s['class'] = "SC-realizes";
					break;
				case 'Specialization':
					s['class'] = "SC-isSpecializationOf";
					break;
				case 'Association':
					s['class'] = "SC-isAssociatedWith";
					s.isUndirected = !rs.getAttribute('isDirected');
					break;
				case 'Assignment':
					s['class'] = "SC-isAssignedTo";
					break;
				default: 
					// The TOGAF element with tag  extensionElements  and title  <empty string>  has not been transformed.
					console.warn('Relationship: Unknown xsi:type ', ty)
			};

			if( s['class'] ) {
				// Additional attributes such as title and description:
				Array.from( rs.children, 
					(ch)=>{
						switch( ch.tagName ) {
							case 'name': 
								s.title = ch.innerHTML;
								break;
							case 'documentation':
								s.description = ch.innerHTML
						}
					}
				);
			
				model.statements.push( s )
			}
		}
	);

	// 5. The hierarchy with pointers to all resources:
	function NodeList(res) {
		// 5.1 first add the folders:
		let nL =  [{
			id: "H-"+hId,
			resource: hId,
			nodes: [{
				id: genID("N-"),
				resource: "FolderDiagrams-" + apx,
				nodes: [],
				changedAt: opts.fileDate
			},{
				id: genID("N-"),
				resource: "FolderGlossary-" + apx,
				nodes: [{
					id: genID("N-"),
					resource: "FolderAct-" + apx,
					nodes: [],
					changedAt: opts.fileDate
				},{
					id: genID("N-"),
					resource: "FolderSta-" + apx,
					nodes: [],
					changedAt: opts.fileDate
				},{
					id: genID("N-"),
					resource: "FolderEvt-" + apx,
					nodes: [],
					changedAt: opts.fileDate
				},{
					id: genID("N-"),
					resource: "FolderCol-" + apx,
					nodes: [],
					changedAt: opts.fileDate
				}],
				changedAt: opts.fileDate
			}],
			changedAt: opts.fileDate
		}];
		// 5.2 Add diagrams to it's folder in original order:
		res.forEach( function(r) { 
			let nd = {
				id: genID("N-"),
				resource: r.id,
				changedAt: opts.fileDate
			};
			if( r['class']=="RC-Diagram" )
				nL[0].nodes[0].nodes.push(nd);
		});
		
		// 5.3 Add Actors, States and Events to the respective folders in alphabetical order:
		if( res.length>1 )
			res.sort( function(bim, bam) {
						bim = bim.title.toLowerCase();
						bam = bam.title.toLowerCase();
						return bim==bam ? 0 : (bim<bam ? -1 : 1) 
			});
		res.forEach( function(r) { 
			let nd = {
				id: genID("N-"),
				resource: r.id,
				changedAt: opts.fileDate
			};
			// sort resources according to their type:
			let idx = ["RC-Actor","RC-State","RC-Event","RC-Collection"].indexOf( r['class'] );
			if( idx>-1 )
				nL[0].nodes[1].nodes[idx].nodes.push(nd)
		});
		return nL
	};
	// 6. Add the resource for the hierarchy root:
	model.resources.push({
		id: hId,
		title: model.title,
		class: "RC-Folder",
		properties: [{
			class: "PC-Text",
			value: model.description || ''
		},{
			class: "PC-Type",
			value: opts.strTogafType
		}],
		changedAt: opts.fileDate
	});
	// Add the tree:
	model.hierarchies = NodeList(model.resources);
	
	console.debug('TOGAF',model);
	return model;

/*	// Reference used files,
	// - the BPMN file:
	model.files = [{
		id: 'F-'+simpleHash(opts.fileName),
		title: opts.fileName,
		blob: new Blob([xmlString], {type: opts.mimeType}),
		type: opts.mimeType,
		changedAt: opts.fileDate
	}];  */

// =======================================
// called functions:	

	// The dataTypes:
	function DataTypes() {
		return [{
	/*		id: "DT-Integer",
			title: "Integer",
			type: "xs:integer",
			minInclusive: -32768,
			maxInclusive: 32767,
			changedAt: opts.fileDate
		},{  */
			id: "DT-ShortString",
			title: "String ["+opts.titleLength+"]",
			description: "String with length "+opts.titleLength,
			type: "xs:string",
			maxLength: opts.titleLength,
			changedAt: opts.fileDate
		},{
			id: "DT-FormattedText",
			title: "XHTML ["+opts.descriptionLength+"]",
			description: "Formatted String with length "+opts.descriptionLength,
			type: "xhtml",
			maxLength: opts.descriptionLength,
			changedAt: opts.fileDate
		}]
	}
	
	// The property classes:
	function PropertyClasses() {
		return [{
				id: "PC-Name",
				title: "dcterms:title",
				dataType: "DT-ShortString",
				changedAt: opts.fileDate
			},{
				id: "PC-Text",
				title: "dcterms:description",
				dataType: "DT-FormattedText",
				changedAt: opts.fileDate
			},{
				id: "PC-Diagram",
				title: "SpecIF:Diagram",
				dataType: "DT-FormattedText",
				changedAt: opts.fileDate
		/*	},{
				id: "PC-Notation",
				title: "SpecIF:Notation",
				dataType: "DT-ShortString",
				changedAt: opts.fileDate  */
			},{
				id: "PC-Type",
				title: "dcterms:type",
				dataType: "DT-ShortString",
				changedAt: opts.fileDate
			}]
	}
	
	// The resource classes:
	function ResourceClasses() {
		return [{
			id: "RC-Diagram",
			title: "SpecIF:Diagram",
			description: "A 'Diagram' is a graphical model view with a specific communication purpose, e.g. a business process or system composition.",
			instantiation: ['user'],
			propertyClasses: ["PC-Name","PC-Text","PC-Diagram","PC-Type"],
			icon: "&#9635;",
			changedAt: opts.fileDate
		},{
			id: "RC-Actor",
			title: "FMC:Actor",
			description: "An 'Actor' is a fundamental model element type representing an active entity, be it an activity, a process step, a function, a system component or a role.",
			instantiation: ['auto'],
			propertyClasses: ["PC-Name","PC-Text","PC-Type"],
			icon: "&#9632;",
			changedAt: opts.fileDate
		},{
			id: "RC-State",
			title: "FMC:State",
			description: "A 'State' is a fundamental model element type representing a passive entity, be it a value, a condition, an information storage or even a physical shape.",
			instantiation: ['auto'],
			propertyClasses: ["PC-Name","PC-Text","PC-Type"],
			icon: "&#9679;",
			changedAt: opts.fileDate
		},{
			id: "RC-Event",
			title: "FMC:Event",
			description: "An 'Event' is a fundamental model element type representing a time reference, a change in condition/value or more generally a synchronisation primitive.",
			instantiation: ['auto'],
			propertyClasses: ["PC-Name","PC-Text","PC-Type"],
			icon: "&#9830;",
			changedAt: opts.fileDate
		},{
/*			id: "RC-Note",
			title: "SpecIF:Note",
			description: "A 'Note' is additional information by the author referring to any resource.",
			propertyClasses: ["PC-Name","PC-Text"],
			changedAt: opts.fileDate  
		},{  */
			id: "RC-Collection",
			title: "SpecIF:Collection",
			instantiation: ['auto'],
			description: "A 'Collection' is an arbitrary group of resources linked with a SpecIF:contains statement. It corresponds to a 'Group' in BPMN Diagrams.",
			propertyClasses: ["PC-Name","PC-Text","PC-Type"],
			changedAt: opts.fileDate
		},{
			id: "RC-Folder",
			title: opts.strFolderType,
			description: "Folder with title and text for chapters or descriptive paragraphs.",
			isHeading: true,
			instantiation: ['auto','user'],
			propertyClasses: ["PC-Name","PC-Text","PC-Type"],
			changedAt: opts.fileDate
		}]
	}
	// The statement classes:
	function StatementClasses() {
		return [{
			id: "SC-shows",
			title: "SpecIF:shows",
			description: "Statement: Plan shows Model-Element",
			instantiation: ['auto'],
			subjectClasses: ["RC-Diagram"],
			objectClasses: ["RC-Actor", "RC-State", "RC-Event"],
			changedAt: opts.fileDate
		},{
			id: "SC-contains",
			title: "SpecIF:contains",
			description: "Statement: Model-Element contains Model-Element",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor", "RC-State", "RC-Event"],
			objectClasses: ["RC-Actor", "RC-State", "RC-Event"],
			changedAt: opts.fileDate
		},{
			// ToDo: Make more specific with respect to subjectClasses and objectClasses, if possible
			id: "SC-isAssignedTo",
			title: opts.strNamespace+"isAssignedTo",
			description: "Statement: An model-element is assigned to a model-element",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor", "RC-State", "RC-Event"],
			objectClasses: ["RC-Actor", "RC-State", "RC-Event"],
			changedAt: opts.fileDate
		},{
			id: "SC-isComposedOf",
			title: opts.strNamespace+"isComposedOf",
			description: "Statement: A state (data-object) is composed of a state",
			instantiation: ['auto'],
			subjectClasses: ["RC-State"],
			objectClasses: ["RC-State"],
			changedAt: opts.fileDate
		},{
			id: "SC-isAggregatedBy",
			title: opts.strNamespace+"isAggregatedBy",
			description: "Statement: A state (data-object) is aggregated by a state",
			instantiation: ['auto'],
			subjectClasses: ["RC-State"],
			objectClasses: ["RC-State"],
			changedAt: opts.fileDate
		},{
			id: "SC-isSpecializationOf",
			title: opts.strNamespace+"isSpecializationOf",
			description: "Statement: A state (data-object) is a specialization of a state",
			instantiation: ['auto'],
			subjectClasses: ["RC-State"],
			objectClasses: ["RC-State"],
			changedAt: opts.fileDate
		},{
			id: "SC-realizes",
			title: "SpecIF:realizes",
			description: "Statement: Actor (Component) realizes an Actor (Function)",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor"],
			objectClasses: ["RC-Actor"],
			changedAt: opts.fileDate
		},{
			id: "SC-serves",
			title: opts.strNamespace+"serves",
			description: "Statement: Actor (Service) serves an Actor (Component, Function)",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor"],
			objectClasses: ["RC-Actor"],
			changedAt: opts.fileDate
		},{
			id: "SC-isAssociatedWith",
			title: "SpecIF:isAssociatedWith",
			description: "Statement: Actor (Component,Function) is associated with an Actor (Component,Function)",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor"],
			objectClasses: ["RC-Actor"],
			changedAt: opts.fileDate
		},{
			id: "SC-stores",
			title: "SpecIF:stores",
			description: "Statement: Actor (Role, Function) writes and reads State (Information)",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor"],
			objectClasses: ["RC-State"],
			changedAt: opts.fileDate
		},{
			id: "SC-writes",
			title: "SpecIF:writes",
			description: "Statement: Actor (Role, Function) writes State (Information)",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor"],
			objectClasses: ["RC-State"],
			changedAt: opts.fileDate
		},{
			id: "SC-reads",
			title: "SpecIF:reads",
			description: "Statement: Actor (Role, Function) reads State (Information)",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor"],
			objectClasses: ["RC-State"],
			changedAt: opts.fileDate
		},{
			id: "SC-precedes",
			title: "SpecIF:precedes",
			description: "A FMC:Actor 'precedes' a FMC:Actor; e.g. in a business process or activity flow.",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor"],
			objectClasses: ["RC-Actor"],
			changedAt: opts.fileDate
		},{
			id: "SC-signals",
			title: "SpecIF:signals",
			description: "A FMC:Actor 'signals' a FMC:Event.",
			instantiation: ['auto'],
			subjectClasses: ["RC-Actor", "RC-Event"],
			objectClasses: ["RC-Event"],
			changedAt: opts.fileDate
		},{
			id: "SC-triggers",
			title: "SpecIF:triggers",
			description: "A FMC:Event 'triggers' a FMC:Actor.",
			instantiation: ['auto'],
			subjectClasses: ["RC-Event"],
			objectClasses: ["RC-Actor"],
			changedAt: opts.fileDate
	/*	},{
			id: "SC-refersTo",
			title: "SpecIF:refersTo",
			description: "A SpecIF:Comment, SpecIF:Note or SpecIF:Issue 'refers to' any other resource.",
			instantiation: ['auto'],
			subjectClasses: ["RC-Note"],
			objectClasses: ["RC-Diagram", "RC-Actor", "RC-State", "RC-Event", "RC-Collection"],
			changedAt: opts.fileDate  */
		}]
	}

	// The folder resources within a hierarchy:
	function Folders() {
		return [{
			id: "FolderDiagrams-" + apx,
			class: "RC-Folder",
			title: opts.strDiagramsFolder,
			properties: [{
				class: "PC-Type",
				value: opts.strDiagramsType
			}],
			changedAt: opts.fileDate
		}, {
			id: "FolderGlossary-" + apx,
			class: "RC-Folder",
			title: opts.strGlossaryFolder,
			properties: [{
				class: "PC-Type",
				value: opts.strGlossaryType
			}],
			changedAt: opts.fileDate
		}, {
			id: "FolderAct-" + apx,
			class: "RC-Folder",
			title: opts.strActorFolder,
			properties: [],
			changedAt: opts.fileDate
		}, {
			id: "FolderSta-" + apx,
			class: "RC-Folder",
			title: opts.strStateFolder,
			properties: [],
			changedAt: opts.fileDate
		}, {
			id: "FolderEvt-" + apx,
			class: "RC-Folder",
			title: opts.strEventFolder,
			properties: [],
			changedAt: opts.fileDate
	/*	}, {
			id: "FolderNte-" + apx,
			class: "RC-Folder",
			title: opts.strAnnotationFolder,
			properties: [{
				class: "PC-Name",
				value: opts.strAnnotationFolder
			}],
			changedAt: opts.fileDate */
		}, {
			id: "FolderCol-" + apx,
			class: "RC-Folder",
			title: opts.strCollectionFolder,
			properties: [],
			changedAt: opts.fileDate
		}]
	}
	
// =======================================
// some helper functions:	

	// Make a very simple hash code from a string:
	// http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
	function simpleHash(str) {for(var r=0,i=0;i<str.length;i++)r=(r<<5)-r+str.charCodeAt(i),r&=r;return r};
	// http://stackoverflow.com/questions/10726909/random-alpha-numeric-string-in-javascript
	function genID(pfx) {
		if( !pfx || pfx.length<1 )
			pfx = 'ID_'
		else
			if( !/^[A-Za-z_]/.test(pfx) ) pfx = '_'+pfx;   // prefix must begin with a letter or '_'
		const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		let result = '';
		for( var i=27; i>0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
		return pfx+result
	}
}
